using System.Text.Json;
using Microsoft.EntityFrameworkCore;
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

    public OrganizationSettingsService(PlatformDbContext db, IAuditLogWriter audit)
    {
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

        var row = await _db.OrganizationSettings.FirstOrDefaultAsync(cancellationToken);
        var now = DateTime.UtcNow;
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

    private static void ValidateCommunications(OrganizationCommunicationsSettingsDto c)
    {
        var provider = (c.OtpProvider ?? "dev-log").Trim().ToLowerInvariant();
        if (provider is not ("dev-log" or "sms" or "email"))
            throw new ArgumentOutOfRangeException(nameof(c.OtpProvider), "مزوّد OTP غير معروف.");
        if (c.SmtpPort is < 1 or > 65535)
            throw new ArgumentOutOfRangeException(nameof(c.SmtpPort), "منفذ SMTP غير صالح.");
    }

    private static OrganizationSettingsDto Defaults() => new()
    {
        Company = new OrganizationCompanySettingsDto(),
        Evaluator = new OrganizationEvaluatorSettingsDto(),
        Branding = new OrganizationBrandingSettingsDto(),
        Communications = new OrganizationCommunicationsSettingsDto(),
        Sla = new OrganizationSlaSettingsDto(),
        UpdatedAtUtc = DateTime.UtcNow,
    };

    private static OrganizationSettingsDto FromRow(OrganizationSettings row)
    {
        try
        {
            var dto = JsonSerializer.Deserialize<OrganizationSettingsDto>(row.SettingsJson, JsonOptions)
                ?? Defaults();
            return new OrganizationSettingsDto
            {
                Company = dto.Company ?? new OrganizationCompanySettingsDto(),
                Evaluator = dto.Evaluator ?? new OrganizationEvaluatorSettingsDto(),
                Branding = dto.Branding ?? new OrganizationBrandingSettingsDto(),
                Communications = NormalizeCommunications(dto.Communications),
                Sla = NormalizeSla(dto.Sla),
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
                Branding = fallback.Branding,
                Communications = fallback.Communications,
                Sla = fallback.Sla,
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
            UpdatedAtUtc = dto.UpdatedAtUtc,
        };

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

    private static OrganizationSettingsDto Merge(
        OrganizationSettingsDto current,
        SaveOrganizationSettingsRequest request) =>
        new()
        {
            Company = request.Company ?? current.Company,
            Evaluator = request.Evaluator ?? current.Evaluator,
            Branding = request.Branding ?? current.Branding,
            Communications = MergeCommunications(current.Communications, request.Communications),
            Sla = NormalizeSla(request.Sla ?? current.Sla),
            UpdatedAtUtc = DateTime.UtcNow,
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
