using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Infrastructure.Services;

public sealed class OrganizationSettingsService : IOrganizationSettingsService
{
 // Distinct from CaseStudyInfoRoles / FieldDictionary singleton rows.
    private static readonly Guid SingletonId = Guid.Parse("c3d4e5f6-a7b8-9012-cdef-345678901234");
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private readonly PlatformDbContext _db;
    private readonly IAuditLogWriter _audit;
    private readonly TimeProvider _time;

    public OrganizationSettingsService(PlatformDbContext db, IAuditLogWriter audit,
        TimeProvider? time = null)
    {
        _time = time ?? TimeProvider.System;

        _db = db;
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
        var row = await _db.OrganizationSettings.AsNoTracking()
            .FirstOrDefaultAsync(cancellationToken);
        return row is null ? Defaults() : FromRow(row);
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

        var row = await _db.OrganizationSettings.FirstOrDefaultAsync(cancellationToken);
        var now = _time.UtcNow();
        var payload = JsonSerializer.Serialize(next, JsonOptions);

        if (row is null)
        {
            row = new OrganizationSettings
            {
                Id = SingletonId,
                SettingsJson = payload,
                UpdatedAtUtc = now,
            };
            _db.OrganizationSettings.Add(row);
        }
        else
        {
            row.SettingsJson = payload;
            row.UpdatedAtUtc = now;
        }

        next = FromRow(row);
 // Audit without secret values — only configuration shape.
        _db.AuditLogs.Add(_audit.Create(
            string.IsNullOrWhiteSpace(actorId) ? "system" : actorId,
            "ORGANIZATION_SETTINGS_SAVED",
            "organization_settings",
            row.Id.ToString(),
            MaskSecrets(current),
            MaskSecrets(next)));
        await _db.SaveChangesAsync(cancellationToken);
        return MaskSecrets(next);
    }

    private static void ValidateSla(OrganizationSlaSettingsDto sla)
    {
        if (sla.DefaultBusinessDays < 1 || sla.DefaultBusinessDays > 60)
            throw new ArgumentOutOfRangeException(nameof(sla.DefaultBusinessDays), "مهلة التنفيذ يجب أن تكون بين 1 و 60 يوم عمل.");
        if (sla.PrivateSectorBusinessDays < 1 || sla.PrivateSectorBusinessDays > 60)
            throw new ArgumentOutOfRangeException(nameof(sla.PrivateSectorBusinessDays), "مهلة القطاع الخاص يجب أن تكون بين 1 و 60 يوم عمل.");
    }

    private static void ValidateValuation(OrganizationValuationSettingsDto v)
    {
        if (v.MaxAdoptedComparables is < 1 or > 20)
            throw new ArgumentOutOfRangeException(nameof(v.MaxAdoptedComparables), "الحد الأقصى للمقارنات المعتمدة يجب أن يكون بين 1 و 20.");
        if (v.ComparableTimeGapMonths is < 1 or > 60)
            throw new ArgumentOutOfRangeException(nameof(v.ComparableTimeGapMonths), "عتبة الفارق الزمني يجب أن تكون بين 1 و 60 شهراً.");
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
 // كانتا تسقطان هنا فتضيع القيم المحفوظة عند القراءة — تصحيح.
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
                MembershipExpiresAt = string.IsNullOrWhiteSpace(v.MembershipExpiresAt)
                    ? null
                    : v.MembershipExpiresAt.Trim(),
                Role = NormalizeValuerRole(v.Role),
                IsActive = v.IsActive,
            })
            .ToList();
    }

    private static string NormalizeValuerRole(string? role)
    {
        var r = (role ?? "assistant").Trim().ToLowerInvariant();
        return r is "certified" or "assistant" or "reviewer" ? r : "assistant";
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

    /// <summary>نصوص تقرير التقييم: فراغ ⟵ افتراضي القالب؛ قص الحقول الطويلة.</summary>
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
