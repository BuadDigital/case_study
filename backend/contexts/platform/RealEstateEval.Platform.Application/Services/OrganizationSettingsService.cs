using System.Text.Json;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Platform.Application.Abstractions;
using RealEstateEval.Platform.Application.Rules;
using RealEstateEval.Platform.Domain;
using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Platform.Application.Services;

/// <summary>
/// Organization settings use case: read with secrets masked, merge-and-validate on save, and
/// the قرار 23 text-package versioning. Persistence goes through
/// <see cref="IOrganizationSettingsRepository"/>, so this file holds rules only - no EF
/// (solid-scorecard finding 1).
/// </summary>
public sealed partial class OrganizationSettingsService : IOrganizationSettingsService
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
        OrganizationBrandingRules.Validate(next.Branding);

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
                OrganizationBrandingRules.ForAudit(MaskSecrets(current)),
                OrganizationBrandingRules.ForAudit(MaskSecrets(next))),
            cancellationToken);
        await _repo.SaveChangesAsync(cancellationToken);
        return MaskSecrets(next);
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

        if (JsonTextEquality.SemanticallyEqual(nextJson, latest.TextsJson))
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


    private OrganizationSettingsDto Defaults() => new()
    {
        Company = NormalizeCompany(new OrganizationCompanySettingsDto()),
        Evaluator = new OrganizationEvaluatorSettingsDto(),
        Valuers = [],
        Branding = new OrganizationBrandingSettingsDto(),
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
            // Empty practice-license dates in old JSON blobs are filled here — UI defaults
            // used to paint over nulls without ever writing them back to SettingsJson.
            var company = NormalizeCompany(dto.Company);
            var valuers = NormalizeValuers(dto.Valuers);
            return new OrganizationSettingsDto
            {
                Company = company,
                Evaluator = CertifiedValuerRules.DeriveEvaluator(valuers, dto.Evaluator, company),
                Valuers = valuers,
                Branding = dto.Branding ?? new OrganizationBrandingSettingsDto(),
                Sla = NormalizeSla(dto.Sla),
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
                Sla = fallback.Sla,
                Valuation = fallback.Valuation,
                ValuationReport = fallback.ValuationReport,
                UpdatedAtUtc = row.UpdatedAtUtc,
            };
        }
    }

    private static OrganizationSettingsDto MaskSecrets(OrganizationSettingsDto dto) =>
        new()
        {
            Company = dto.Company,
            Evaluator = dto.Evaluator,
            Valuers = NormalizeValuers(dto.Valuers),
            Branding = dto.Branding,
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
                StaffUserId = string.IsNullOrWhiteSpace(v.StaffUserId) ? null : v.StaffUserId.Trim(),
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
        SaveOrganizationSettingsRequest request)
    {
        var company = NormalizeCompany(request.Company ?? current.Company);
        var valuers = request.Valuers is null
            ? NormalizeValuers(current.Valuers)
            : NormalizeValuers(request.Valuers);
        return new()
        {
            Company = company,
            // Derived, never taken from the request: the certified roster row is the source.
            Evaluator = CertifiedValuerRules.DeriveEvaluator(valuers, request.Evaluator ?? current.Evaluator, company),
            Valuers = valuers,
            Branding = CertifiedValuerRules.MirrorCertifiedSignature(
                request.Branding ?? current.Branding,
                valuers,
                JsonOptions),
            Sla = NormalizeSla(request.Sla ?? current.Sla),
            Valuation = request.Valuation ?? current.Valuation,
            ValuationReport = NormalizeValuationReport(
                request.ValuationReport ?? current.ValuationReport),
            UpdatedAtUtc = _time.UtcNow(),
        };
    }

    /// <summary>
    /// Firm practice-license fields — same defaults as frontend ORG_COMPANY_DEFAULTS.
    /// Old SettingsJson rows often omit these keys; without this the API returns null while
    /// the settings UI paints defaults that never get written until an explicit company save.
    /// </summary>
    private static OrganizationCompanySettingsDto NormalizeCompany(
        OrganizationCompanySettingsDto? company)
    {
        var c = company ?? new OrganizationCompanySettingsDto();
        return new OrganizationCompanySettingsDto
        {
            Name = string.IsNullOrWhiteSpace(c.Name)
                ? "شركة إجادة المهنية للتقييم العقاري"
                : c.Name.Trim(),
            TaxNumber = BlankToNull(c.TaxNumber),
            Address = BlankToNull(c.Address),
            CommercialRegistration = BlankToNull(c.CommercialRegistration),
            PracticeLicenseNumber = string.IsNullOrWhiteSpace(c.PracticeLicenseNumber)
                ? "1302"
                : c.PracticeLicenseNumber.Trim(),
            PracticeLicenseIssuedAt = string.IsNullOrWhiteSpace(c.PracticeLicenseIssuedAt)
                ? "2022-03-10"
                : c.PracticeLicenseIssuedAt.Trim(),
            PracticeLicenseExpiresAt = string.IsNullOrWhiteSpace(c.PracticeLicenseExpiresAt)
                ? "2027-03-10"
                : c.PracticeLicenseExpiresAt.Trim(),
            Email = BlankToNull(c.Email),
            Phone = BlankToNull(c.Phone),
            Website = BlankToNull(c.Website),
        };
    }

    private static string? BlankToNull(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

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
        Terms = ValuationReportSettingsDefaults.Clip(
            ValuationReportSettingsDefaults.UpgradeTerms(dto.Terms), ValuationReportSettingsDefaults.Terms),
        Restrictions = ValuationReportSettingsDefaults.Clip(
            ValuationReportSettingsDefaults.UpgradeRestrictions(dto.Restrictions),
            ValuationReportSettingsDefaults.Restrictions),
        IvsStandards = ValuationReportSettingsDefaults.Clip(
            ValuationReportSettingsDefaults.UpgradeIvsStandards(dto.IvsStandards),
            ValuationReportSettingsDefaults.IvsStandards),
        Glossary = ValuationReportSettingsDefaults.Clip(
            ValuationReportSettingsDefaults.UpgradeGlossary(dto.Glossary),
            ValuationReportSettingsDefaults.Glossary),
        FinishingLuxury = ValuationReportSettingsDefaults.Clip(
            dto.FinishingLuxury, ValuationReportSettingsDefaults.FinishingLuxury),
        FinishingMedium = ValuationReportSettingsDefaults.Clip(
            dto.FinishingMedium, ValuationReportSettingsDefaults.FinishingMedium),
        FinishingOrdinary = ValuationReportSettingsDefaults.Clip(
            dto.FinishingOrdinary, ValuationReportSettingsDefaults.FinishingOrdinary),
        SpecialAssumptionLibrary = ValuationReportSettingsDefaults.NormalizeLibrary(
            dto.SpecialAssumptionLibrary).ToList(),
    };

}
