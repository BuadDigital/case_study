using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Platform.Application.Abstractions;
using RealEstateEval.Platform.Infrastructure.Data.Contexts;

namespace RealEstateEval.Platform.Infrastructure.Services;

public sealed class AuditLogQueryService(PlatformDbContext db) : IAuditLogQueryService
{
    public async Task<AuditLogPageDto> ListAsync(
        string? entityType,
        string? entityId,
        string? action,
        string? actorId,
        int page,
        int limit,
        CancellationToken cancellationToken = default)
    {
        page = Math.Max(1, page);
        limit = Math.Clamp(limit, 1, 200);

        var query = db.AuditLogs.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(entityType))
            query = query.Where(row => row.EntityType == entityType.Trim());
        if (!string.IsNullOrWhiteSpace(entityId))
            query = query.Where(row => row.EntityId == entityId.Trim());
        if (!string.IsNullOrWhiteSpace(action))
            query = query.Where(row => row.Action == action.Trim());
        if (!string.IsNullOrWhiteSpace(actorId))
            query = query.Where(row => row.ActorId == actorId.Trim());

        var total = await query.CountAsync(cancellationToken);
        var rows = await query
            .OrderByDescending(row => row.CreatedAtUtc)
            .ThenByDescending(row => row.Id)
            .Skip((page - 1) * limit)
            .Take(limit)
            .ToListAsync(cancellationToken);

        return new AuditLogPageDto
        {
            Items = rows.Select(row => new AuditLogDto
            {
                Id = row.Id,
                ActorId = row.ActorId,
                Action = row.Action,
                EntityType = row.EntityType,
                EntityId = row.EntityId,
                Before = Parse(row.BeforeJson),
                After = Parse(row.AfterJson),
                CreatedAtUtc = row.CreatedAtUtc,
            }).ToList(),
            Page = page,
            Limit = limit,
            Total = total,
        };
    }

    private static JsonElement Parse(string json)
    {
        using var document = JsonDocument.Parse(json);
        return document.RootElement.Clone();
    }
}
