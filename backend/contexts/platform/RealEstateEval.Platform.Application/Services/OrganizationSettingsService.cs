using System.Text.Json;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Platform.Application.Abstractions;
using RealEstateEval.Platform.Domain;
using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Platform.Application.Services;

/// <summary>
/// Organization settings use case: read with secrets masked, merge-and-validate on save, and
/// the قرار 23 text-package versioning. Persistence goes through
/// <see cref="IOrganizationSettingsRepository"/>, so this file holds rules only - no EF
/// (solid-scorecard finding 1).
/// </summary>
public sealed class OrganizationSettingsService : IOrganizationSettingsService
{
 // Distinct from CaseStudyInfoRoles / FieldDictionary singleton rows.
    private static readonly Guid SingletonId = Guid.Parse("c3d4e5f6-a7b8-9012-cdef-345678901234");
    private static readonly JsonSerializerOptions JsonOptions = JsonDefaults.Web;

    private readonly IOrganizationSettingsRepository _repo;
    private readonly IAuditLogWriter _audit;
    private readonly TimeProvider _time;

    public OrganizationSettingsService(
        IOrganizationSettingsRepository repo,
        IAuditLogWriter audit,
        TimeProvider? time = null)
    {
        _time = time ?? TimeProvider.System;

        _repo = repo;
        _audit = audit;
    }

    public async Task<OrganizationSettingsDto> GetAsync(CancellationToken cancellationToken = default)
    {
        var internalDto = await GetInternalAsync(cancellationToken);
        return MaskSecrets(internalDto);
    }

    public async Task<OrganizationSettingsDto> GetInternalAsync(
        CancellationToken cancellationToken = default)
    {
        var row = await _repo.GetSettingsAsync(cancellationToken);
        var dto = row is null ? Defaults() : FromRow(row);

        // Decision 23: Seed Package (default) version 1 implicit; Version History actually starts with
        // The first save touches the managed block.
        var latestVersion = await _repo.GetLatestTextPackageVersionAsync(cancellationToken);
        dto.ValuationReport.TextPackageVersion =
            latestVersion ?? ReportTextPackageRules.InitialVersion;
        return dto;
    }

    public async Task<OrganizationSettingsDto> SaveAsync(
        SaveOrganizationSettingsRequest request,
        string actorId,
        CancellationToken cancellationToken = default)
    {
        var current = await GetInternalAsync(cancellationToken);
        var next = Merge(current, request);
        ValidateSla(next.Sla);
        ValidateCommunications(next.Communications);
        ValidateValuation(next.Valuation);
        ValidateBranding(next.Branding);

        var row = await _repo.FindSettingsAsync(cancellationToken);
        var now = _time.UtcNow();

        // Decision 23: Any modification in the managed text block releases a complete new text package with number
        // one version for the package — an immutable version history.
        var textPackageVersion = await EnsureTextPackageVersionAsync(
            current.ValuationReport, next.ValuationReport, actorId, now, cancellationToken);
        next.ValuationReport.TextPackageVersion = textPackageVersion;

        var payload = JsonSerializer.Serialize(next, JsonOptions);

        if (row is null)
        {
            row = new OrganizationSettings
            {
                Id = SingletonId,
                SettingsJson = payload,
                UpdatedAtUtc = now,
            };
            await _repo.AddSettingsAsync(row, cancellationToken);
        }
        else
        {
            row.SettingsJson = payload;
            row.UpdatedAtUtc = now;
        }

        next = FromRow(row);
        // Reconstruction via normalization drops the calculated number — it is re-stamped from the record.
        next.ValuationReport.TextPackageVersion = textPackageVersion;
 // Audit without secret values — only configuration shape.
        await _repo.AppendAuditAsync(
            _audit.Create(
                string.IsNullOrWhiteSpace(actorId) ? "system" : actorId,
                "ORGANIZATION_SETTINGS_SAVED",
                "organization_settings",
                row.Id.ToString(),
                MaskSecrets(current),
                MaskSecrets(next)),
            cancellationToken);
        await _repo.SaveChangesAsync(cancellationToken);
        return MaskSecrets(next);
    }

    private static void ValidateSla(OrganizationSlaSettingsDto sla)
    {
        if (sla.DefaultBusinessDays < 1 || sla.DefaultBusinessDays > 60)
            throw new ArgumentOutOfRangeException(nameof(sla.DefaultBusinessDays), "مهلة التنفيذ يجب أن تكون بين 1 و 60 يوم عمل.");
        if (sla.PrivateSectorBusinessDays < 1 || sla.PrivateSectorBusinessDays > 60)
            throw new ArgumentOutOfRangeException(nameof(sla.PrivateSectorBusinessDays), "مهلة القطاع الخاص يجب أن تكون بين 1 و 60 يوم عمل.");
    }

 /// <summary>
 /// Decision 23: Managed block = 6 fields (Professional Standards/Autonomy/Restrictions/Conditions/IVS/Glossary).
 /// Seed Package “Copy 1” is recorded when the block is first touched, any subsequent variation adds a copy
 /// Completely new — rows are never modified.
 /// </summary>
    private async Task<int> EnsureTextPackageVersionAsync(
        OrganizationValuationReportSettingsDto current,
        OrganizationValuationReportSettingsDto next,
        string actorId,
        DateTime nowUtc,
        CancellationToken cancellationToken)
    {
        var latest = await _repo.GetLatestTextPackageAsync(cancellationToken);

        var nextJson = CanonicalTextsJson(next);

        if (latest is null)
        {
            var currentJson = CanonicalTextsJson(current);
            await _repo.AddTextPackageAsync(
                new ValuationReportTextPackage
                {
                    Id = Guid.NewGuid(),
                    Version = ReportTextPackageRules.InitialVersion,
                    TextsJson = currentJson,
                    CreatedAtUtc = nowUtc,
                    CreatedByUserId = null, // Seed package — not a user edit.
                },
                cancellationToken);
            if (string.Equals(nextJson, currentJson, StringComparison.Ordinal))
                return ReportTextPackageRules.InitialVersion;

            await _repo.AddTextPackageAsync(
                new ValuationReportTextPackage
                {
                    Id = Guid.NewGuid(),
                    Version = ReportTextPackageRules.InitialVersion + 1,
                    TextsJson = nextJson,
                    CreatedAtUtc = nowUtc,
                    CreatedByUserId = string.IsNullOrWhiteSpace(actorId) ? null : actorId,
                },
                cancellationToken);
            return ReportTextPackageRules.InitialVersion + 1;
        }

        if (string.Equals(nextJson, latest.TextsJson, StringComparison.Ordinal))
            return latest.Version;

        var version = latest.Version + 1;
        await _repo.AddTextPackageAsync(
            new ValuationReportTextPackage
            {
                Id = Guid.NewGuid(),
                Version = version,
                TextsJson = nextJson,
                CreatedAtUtc = nowUtc,
                CreatedByUserId = string.IsNullOrWhiteSpace(actorId) ? null : actorId,
            },
            cancellationToken);
        return version;
    }

 /// <summary>Fixed order for literal comparison — only the six fields (no version number).</summary>
    private static string CanonicalTextsJson(OrganizationValuationReportSettingsDto vr) =>
        JsonSerializer.Serialize(new
        {
            professionalStandards = vr.ProfessionalStandards ?? "",
            independence = vr.Independence ?? "",
            restrictions = vr.Restrictions ?? "",
            terms = vr.Terms ?? "",
            ivsStandards = vr.IvsStandards ?? "",
            glossary = vr.Glossary ?? "",
        }, JsonOptions);

    private static void ValidateValuation(OrganizationValuationSettingsDto v)
    {
        if (v.MaxAdoptedComparables is < 1 or > 20)
            throw new ArgumentOutOfRangeException(nameof(v.MaxAdoptedComparables), "الحد الأقصى للمقارنات المعتمدة يجب أن يكون بين 1 و 20.");
        if (v.ComparableTimeGapMonths is < 1 or > 60)
            throw new ArgumentOutOfRangeException(nameof(v.ComparableTimeGapMonths), "عتبة الفارق الزمني يجب أن تكون بين 1 و 60 شهراً.");
        if (v.AreaFactorPct is < 0.1m or > 50m)
            throw new ArgumentOutOfRangeException(nameof(v.AreaFactorPct), "معامل المساحة يجب أن يكون بين 0.1 و 50٪.");
        if (v.AnnualMarketRatePct is < 0m or > 50m)
            throw new ArgumentOutOfRangeException(nameof(v.AnnualMarketRatePct), "معدل تغير السوق السنوي يجب أن يكون بين 0 و 50٪.");
        if (v.MarketValueRoundDecimals is < 0 or > 6)
            throw new ArgumentOutOfRangeException(nameof(v.MarketValueRoundDecimals), "أسّ تقريب قيمة السوق يجب أن يكون بين 0 و 6.");
    }

    private static void ValidateBranding(OrganizationBrandingSettingsDto b)
    {
        static void Mm(decimal? v, string name, decimal max)
        {
            if (v is null) return;
            if (v.Value < 0 || v.Value > max)
                throw new ArgumentOutOfRangeException(name, $"قيمة {name} خارج النطاق.");
        }

        if (b.StampWidthCm is > 0 and (< 0.5m or > 20m))
            throw new ArgumentOutOfRangeException(nameof(b.StampWidthCm), "عرض الختم يجب أن يكون بين 0.5 و 20 سم.");
        if (b.StampHeightCm is > 0 and (< 0.5m or > 20m))
            throw new ArgumentOutOfRangeException(nameof(b.StampHeightCm), "ارتفاع الختم يجب أن يكون بين 0.5 و 20 سم.");
        if (b.SignatureWidthCm is > 0 and (< 0.5m or > 20m))
            throw new ArgumentOutOfRangeException(nameof(b.SignatureWidthCm), "عرض التوقيع يجب أن يكون بين 0.5 و 20 سم.");
        if (b.SignatureHeightCm is > 0 and (< 0.5m or > 20m))
            throw new ArgumentOutOfRangeException(nameof(b.SignatureHeightCm), "ارتفاع التوقيع يجب أن يكون بين 0.5 و 20 سم.");
        Mm(b.LetterheadHeadMm, "الهامش الأعلى", 297);
        Mm(b.LetterheadFootTopMm, "الهامش الأسفل", 297);
        Mm(b.LetterheadPadMm, "الهامش الأيسر", 210);
        Mm(b.LetterheadPadStartMm, "الهامش الأيمن", 210);
        Mm(b.LetterheadStripMm, "شريط الكليشة", 210);
    }

    private static void ValidateCommunications(OrganizationCommunicationsSettingsDto c)
    {
        var provider = (c.OtpProvider ?? "dev-log").Trim().ToLowerInvariant();
        if (provider is not ("dev-log" or "sms" or "email"))
            throw new ArgumentOutOfRangeException(nameof(c.OtpProvider), "مزوّد OTP غير معروف.");
        if (c.SmtpPort is < 1 or > 65535)
            throw new ArgumentOutOfRangeException(nameof(c.SmtpPort), "منفذ SMTP غير صالح.");
    }

    private OrganizationSettingsDto Defaults() => new()
    {
        Company = new OrganizationCompanySettingsDto(),
        Evaluator = new OrganizationEvaluatorSettingsDto(),
        Valuers = [],
        Branding = new OrganizationBrandingSettingsDto(),
        Communications = new OrganizationCommunicationsSettingsDto(),
        Sla = new OrganizationSlaSettingsDto(),
        Valuation = new OrganizationValuationSettingsDto(),
        ValuationReport = NormalizeValuationReport(new OrganizationValuationReportSettingsDto()),
        UpdatedAtUtc = _time.UtcNow(),
    };

    private OrganizationSettingsDto FromRow(OrganizationSettings row)
    {
        try
        {
            var dto = JsonSerializer.Deserialize<OrganizationSettingsDto>(row.SettingsJson, JsonOptions)
                ?? Defaults();
            return new OrganizationSettingsDto
            {
                Company = dto.Company ?? new OrganizationCompanySettingsDto(),
                Evaluator = dto.Evaluator ?? new OrganizationEvaluatorSettingsDto(),
                Valuers = NormalizeValuers(dto.Valuers),
                Branding = dto.Branding ?? new OrganizationBrandingSettingsDto(),
                Communications = NormalizeCommunications(dto.Communications),
                Sla = NormalizeSla(dto.Sla),
 // They were dropped here and the saved values were lost when reading - Correction.
                Valuation = dto.Valuation ?? new OrganizationValuationSettingsDto(),
                ValuationReport = NormalizeValuationReport(
                    dto.ValuationReport ?? new OrganizationValuationReportSettingsDto()),
                UpdatedAtUtc = row.UpdatedAtUtc,
            };
        }
        catch
        {
            var fallback = Defaults();
            return new OrganizationSettingsDto
            {
                Company = fallback.Company,
                Evaluator = fallback.Evaluator,
                Valuers = fallback.Valuers,
                Branding = fallback.Branding,
                Communications = fallback.Communications,
                Sla = fallback.Sla,
                Valuation = fallback.Valuation,
                ValuationReport = fallback.ValuationReport,
                UpdatedAtUtc = row.UpdatedAtUtc,
            };
        }
    }

    private static OrganizationCommunicationsSettingsDto NormalizeCommunications(
        OrganizationCommunicationsSettingsDto? c) =>
        c is null
            ? new OrganizationCommunicationsSettingsDto()
            : new OrganizationCommunicationsSettingsDto
            {
                OtpProvider = string.IsNullOrWhiteSpace(c.OtpProvider) ? "dev-log" : c.OtpProvider,
                DefaultOtpChannel = string.IsNullOrWhiteSpace(c.DefaultOtpChannel)
                    ? "sms"
                    : c.DefaultOtpChannel,
                SmsSenderId = c.SmsSenderId,
                EmailFrom = c.EmailFrom,
                SmsApiUrl = c.SmsApiUrl,
                SmsApiKey = c.SmsApiKey,
                SmsApiKeyConfigured = !string.IsNullOrWhiteSpace(c.SmsApiKey),
                SmtpHost = c.SmtpHost,
                SmtpPort = c.SmtpPort is < 1 or > 65535 ? 587 : c.SmtpPort,
                SmtpUsername = c.SmtpUsername,
                SmtpPassword = c.SmtpPassword,
                SmtpPasswordConfigured = !string.IsNullOrWhiteSpace(c.SmtpPassword),
            };

    private static OrganizationSettingsDto MaskSecrets(OrganizationSettingsDto dto) =>
        new()
        {
            Company = dto.Company,
            Evaluator = dto.Evaluator,
            Valuers = NormalizeValuers(dto.Valuers),
            Branding = dto.Branding,
            Communications = new OrganizationCommunicationsSettingsDto
            {
                OtpProvider = dto.Communications.OtpProvider,
                DefaultOtpChannel = dto.Communications.DefaultOtpChannel,
                SmsSenderId = dto.Communications.SmsSenderId,
                EmailFrom = dto.Communications.EmailFrom,
                SmsApiUrl = dto.Communications.SmsApiUrl,
                SmsApiKey = null,
                SmsApiKeyConfigured = !string.IsNullOrWhiteSpace(dto.Communications.SmsApiKey)
                    || dto.Communications.SmsApiKeyConfigured,
                SmtpHost = dto.Communications.SmtpHost,
                SmtpPort = dto.Communications.SmtpPort,
                SmtpUsername = dto.Communications.SmtpUsername,
                SmtpPassword = null,
                SmtpPasswordConfigured = !string.IsNullOrWhiteSpace(dto.Communications.SmtpPassword)
                    || dto.Communications.SmtpPasswordConfigured,
            },
            Sla = dto.Sla,
            Valuation = dto.Valuation,
            ValuationReport = dto.ValuationReport,
            UpdatedAtUtc = dto.UpdatedAtUtc,
        };

    private static List<OrganizationValuerRosterEntryDto> NormalizeValuers(
        IEnumerable<OrganizationValuerRosterEntryDto>? valuers)
    {
        if (valuers is null) return [];
        return valuers
            .Where(v => !string.IsNullOrWhiteSpace(v.NameAr))
            .Select(v => new OrganizationValuerRosterEntryDto
            {
                Id = string.IsNullOrWhiteSpace(v.Id) ? Guid.NewGuid().ToString("N") : v.Id.Trim(),
                NameAr = v.NameAr.Trim(),
                LicenseNumber = string.IsNullOrWhiteSpace(v.LicenseNumber) ? null : v.LicenseNumber.Trim(),
                MembershipNumber = string.IsNullOrWhiteSpace(v.MembershipNumber)
                    ? null
                    : v.MembershipNumber.Trim(),
                MembershipCategory = string.IsNullOrWhiteSpace(v.MembershipCategory)
                    ? null
                    : v.MembershipCategory.Trim(),
                LicenseExpiresAt = string.IsNullOrWhiteSpace(v.LicenseExpiresAt)
                    ? null
                    : v.LicenseExpiresAt.Trim(),
                LicenseIssuedAt = string.IsNullOrWhiteSpace(v.LicenseIssuedAt)
                    ? null
                    : v.LicenseIssuedAt.Trim(),
                MembershipExpiresAt = string.IsNullOrWhiteSpace(v.MembershipExpiresAt)
                    ? null
                    : v.MembershipExpiresAt.Trim(),
                Role = NormalizeValuerRole(v.Role),
                IsActive = v.IsActive,
                SignatureUrl = string.IsNullOrWhiteSpace(v.SignatureUrl) ? null : v.SignatureUrl.Trim(),
            })
            .ToList();
    }

    private static string NormalizeValuerRole(string? role)
    {
        var r = (role ?? "assistant").Trim().ToLowerInvariant();
        return r is "certified" or "valuer" or "assistant" or "reviewer" ? r : "assistant";
    }

    private static OrganizationSlaSettingsDto NormalizeSla(OrganizationSlaSettingsDto? sla) =>
        new()
        {
            DefaultBusinessDays = sla is null || sla.DefaultBusinessDays < 1
                ? 4
                : sla.DefaultBusinessDays,
            PrivateSectorBusinessDays = sla is null || sla.PrivateSectorBusinessDays < 1
                ? 10
                : sla.PrivateSectorBusinessDays,
        };

    private OrganizationSettingsDto Merge(
        OrganizationSettingsDto current,
        SaveOrganizationSettingsRequest request) =>
        new()
        {
            Company = request.Company ?? current.Company,
            Evaluator = request.Evaluator ?? current.Evaluator,
            Valuers = request.Valuers is null
                ? NormalizeValuers(current.Valuers)
                : NormalizeValuers(request.Valuers),
            Branding = request.Branding ?? current.Branding,
            Communications = MergeCommunications(current.Communications, request.Communications),
            Sla = NormalizeSla(request.Sla ?? current.Sla),
            Valuation = request.Valuation ?? current.Valuation,
            ValuationReport = NormalizeValuationReport(
                request.ValuationReport ?? current.ValuationReport),
            UpdatedAtUtc = _time.UtcNow(),
        };

    /// <summary>Valuation Report text: blank ⟵ template default; trim long fields.</summary>
    private static OrganizationValuationReportSettingsDto NormalizeValuationReport(
        OrganizationValuationReportSettingsDto dto) => new()
    {
        ReportType = ValuationReportSettingsDefaults.Clip(dto.ReportType, ValuationReportSettingsDefaults.ReportType, 200),
        Currency = ValuationReportSettingsDefaults.Clip(dto.Currency, ValuationReportSettingsDefaults.Currency, 200),
        ValuationBranch = ValuationReportSettingsDefaults.Clip(
            dto.ValuationBranch, ValuationReportSettingsDefaults.ValuationBranch, 200),
        KeyInputsText = ValuationReportSettingsDefaults.Clip(
            dto.KeyInputsText, ValuationReportSettingsDefaults.KeyInputsText),
        ProfessionalStandards = ValuationReportSettingsDefaults.Clip(
            dto.ProfessionalStandards, ValuationReportSettingsDefaults.ProfessionalStandards),
        Independence = ValuationReportSettingsDefaults.Clip(
            dto.Independence, ValuationReportSettingsDefaults.Independence),
        ResearchScopeText = ValuationReportSettingsDefaults.Clip(
            dto.ResearchScopeText, ValuationReportSettingsDefaults.ResearchScopeText),
        Terms = ValuationReportSettingsDefaults.Clip(dto.Terms, ValuationReportSettingsDefaults.Terms),
        Restrictions = ValuationReportSettingsDefaults.Clip(
            dto.Restrictions, ValuationReportSettingsDefaults.Restrictions),
        IvsStandards = ValuationReportSettingsDefaults.Clip(
            dto.IvsStandards, ValuationReportSettingsDefaults.IvsStandards),
        Glossary = ValuationReportSettingsDefaults.Clip(dto.Glossary, ValuationReportSettingsDefaults.Glossary),
        FinishingLuxury = ValuationReportSettingsDefaults.Clip(
            dto.FinishingLuxury, ValuationReportSettingsDefaults.FinishingLuxury),
        FinishingMedium = ValuationReportSettingsDefaults.Clip(
            dto.FinishingMedium, ValuationReportSettingsDefaults.FinishingMedium),
        FinishingOrdinary = ValuationReportSettingsDefaults.Clip(
            dto.FinishingOrdinary, ValuationReportSettingsDefaults.FinishingOrdinary),
        SpecialAssumptionLibrary = ValuationReportSettingsDefaults.NormalizeLibrary(
            dto.SpecialAssumptionLibrary).ToList(),
    };

    private static OrganizationCommunicationsSettingsDto MergeCommunications(
        OrganizationCommunicationsSettingsDto current,
        OrganizationCommunicationsSettingsDto? incoming)
    {
        if (incoming is null) return current;
        return new OrganizationCommunicationsSettingsDto
        {
            OtpProvider = string.IsNullOrWhiteSpace(incoming.OtpProvider)
                ? current.OtpProvider
                : incoming.OtpProvider,
            DefaultOtpChannel = string.IsNullOrWhiteSpace(incoming.DefaultOtpChannel)
                ? current.DefaultOtpChannel
                : incoming.DefaultOtpChannel,
            SmsSenderId = incoming.SmsSenderId ?? current.SmsSenderId,
            EmailFrom = incoming.EmailFrom ?? current.EmailFrom,
            SmsApiUrl = incoming.SmsApiUrl ?? current.SmsApiUrl,
            SmsApiKey = string.IsNullOrWhiteSpace(incoming.SmsApiKey)
                ? current.SmsApiKey
                : incoming.SmsApiKey,
            SmtpHost = incoming.SmtpHost ?? current.SmtpHost,
            SmtpPort = incoming.SmtpPort > 0 ? incoming.SmtpPort : current.SmtpPort,
            SmtpUsername = incoming.SmtpUsername ?? current.SmtpUsername,
            SmtpPassword = string.IsNullOrWhiteSpace(incoming.SmtpPassword)
                ? current.SmtpPassword
                : incoming.SmtpPassword,
        };
    }
}
