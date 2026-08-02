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
        var row = await _db.OrganizationSettings.AsNoTracking()
            .FirstOrDefaultAsync(cancellationToken);
        return row is null ? Defaults() : FromRow(row);
    }

    public async Task<OrganizationSettingsDto> SaveAsync(
        SaveOrganizationSettingsRequest request,
        string actorId,
        CancellationToken cancellationToken = default)
    {
        var current = await GetAsync(cancellationToken);
        var next = Merge(current, request);
        ValidateSla(next.Sla);

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
        _db.AuditLogs.Add(_audit.Create(
            string.IsNullOrWhiteSpace(actorId) ? "system" : actorId,
            "ORGANIZATION_SETTINGS_SAVED",
            "organization_settings",
            row.Id.ToString(),
            current,
            next));
        await _db.SaveChangesAsync(cancellationToken);
        return next;
    }

    private static void ValidateSla(OrganizationSlaSettingsDto sla)
    {
        if (sla.DefaultBusinessDays < 1 || sla.DefaultBusinessDays > 60)
            throw new ArgumentOutOfRangeException(nameof(sla.DefaultBusinessDays), "مهلة التنفيذ يجب أن تكون بين 1 و 60 يوم عمل.");
        if (sla.PrivateSectorBusinessDays < 1 || sla.PrivateSectorBusinessDays > 60)
            throw new ArgumentOutOfRangeException(nameof(sla.PrivateSectorBusinessDays), "مهلة القطاع الخاص يجب أن تكون بين 1 و 60 يوم عمل.");
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
                Communications = dto.Communications ?? new OrganizationCommunicationsSettingsDto(),
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
            Communications = request.Communications ?? current.Communications,
            Sla = NormalizeSla(request.Sla ?? current.Sla),
            UpdatedAtUtc = DateTime.UtcNow,
        };
}
