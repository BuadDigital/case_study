using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Platform.Application.Abstractions;
using RealEstateEval.Platform.Infrastructure.Data.Contexts;
using RealEstateEval.Platform.Application.Contracts;
using RealEstateEval.Platform.Domain;

namespace RealEstateEval.Platform.Infrastructure.Services;

public sealed class CaseStudyInfoRolesConfigService : ICaseStudyInfoRolesConfigService
{
    private static readonly Guid SingletonId = Guid.Parse("a1b2c3d4-e5f6-7890-abcd-ef1234567890");

    private static readonly HashSet<string> ValidPartyIds =
    [
        "specA", "insp", "gov", "val", "eng", "sup",
    ];

    private static readonly HashSet<string> ValidRoleTypes =
    [
        "primary", "secondary", "verify", "none",
    ];

    private readonly PlatformDbContext _db;
    private readonly IAuditLogWriter _audit;
    private readonly TimeProvider _time;

    public CaseStudyInfoRolesConfigService(
        PlatformDbContext db,
        IAuditLogWriter audit,
        TimeProvider? time = null)
    {
        _time = time ?? TimeProvider.System;

        _db = db;
        _audit = audit;
    }

    public async Task<CaseStudyInfoRolesConfigDto> GetAsync(
        CancellationToken cancellationToken = default)
    {
        var row = await _db.CaseStudyInfoRolesConfigs
            .AsNoTracking()
            .FirstOrDefaultAsync(cancellationToken);

        return row is null ? EmptyDto() : ToDto(row);
    }

    public async Task<CaseStudyInfoRolesConfigDto> SaveAsync(
        SaveCaseStudyInfoRolesRequest request,
        string actorId,
        CancellationToken cancellationToken = default)
    {
        if (request.Matrix is null)
            throw new ArgumentException("matrix is required", nameof(request));

        var sanitizedMatrix = SanitizeMatrix(request.Matrix);
        var notes = request.Notes ?? new Dictionary<string, string>();

        var row = await _db.CaseStudyInfoRolesConfigs
            .FirstOrDefaultAsync(cancellationToken);
        var before = row is null ? null : ToDto(row);

        var now = _time.UtcNow();
        if (row is null)
        {
            row = new CaseStudyInfoRolesConfig
            {
                Id = SingletonId,
                MatrixJson = JsonSerializer.Serialize(sanitizedMatrix),
                NotesJson = JsonSerializer.Serialize(notes),
                UpdatedAtUtc = now,
            };
            _db.CaseStudyInfoRolesConfigs.Add(row);
        }
        else
        {
            row.MatrixJson = JsonSerializer.Serialize(sanitizedMatrix);
            row.NotesJson = JsonSerializer.Serialize(notes);
            row.UpdatedAtUtc = now;
        }

        var after = ToDto(row);
        _db.AuditLogs.Add(_audit.Create(
            actorId,
            "CASE_STUDY_INFO_ROLES_SAVED",
            "case_study_info_roles",
            row.Id.ToString(),
            before,
            after));
        await _db.SaveChangesAsync(cancellationToken);
        return after;
    }

    private static Dictionary<string, Dictionary<string, string>> SanitizeMatrix(
        Dictionary<string, Dictionary<string, string?>> matrix)
    {
        var result = new Dictionary<string, Dictionary<string, string>>();

        foreach (var (questionKey, parties) in matrix)
        {
            if (string.IsNullOrWhiteSpace(questionKey) || parties is null)
                continue;

            var row = new Dictionary<string, string>();
            foreach (var (partyId, role) in parties)
            {
                if (!ValidPartyIds.Contains(partyId))
                    continue;
                if (string.IsNullOrWhiteSpace(role) || !ValidRoleTypes.Contains(role))
                    continue;
                if (role == "none")
                    continue;
                row[partyId] = role;
            }

            result[questionKey] = row;
        }

        return result;
    }

    private static CaseStudyInfoRolesConfigDto ToDto(CaseStudyInfoRolesConfig row)
    {
        var matrix = JsonSerializer.Deserialize<Dictionary<string, Dictionary<string, string>>>(
                         row.MatrixJson)
                     ?? new Dictionary<string, Dictionary<string, string>>();
        var notes = JsonSerializer.Deserialize<Dictionary<string, string>>(row.NotesJson)
                    ?? new Dictionary<string, string>();
        return new CaseStudyInfoRolesConfigDto
        {
            Matrix = matrix,
            Notes = notes,
            UpdatedAt = row.UpdatedAtUtc,
        };
    }

    private CaseStudyInfoRolesConfigDto EmptyDto() => new()
    {
        Matrix = new Dictionary<string, Dictionary<string, string>>(),
        Notes = new Dictionary<string, string>(),
        UpdatedAt = _time.UtcNow(),
    };
}
