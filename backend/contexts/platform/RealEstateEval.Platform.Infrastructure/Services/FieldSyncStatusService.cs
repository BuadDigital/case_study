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

public sealed class FieldSyncStatusService(PlatformDbContext db,
    TimeProvider? time = null) : IFieldSyncStatusService
{
    private readonly TimeProvider _time = time ?? TimeProvider.System;

    private static readonly TimeSpan StaleAfter = TimeSpan.FromHours(2);
    private static readonly JsonSerializerOptions JsonOptions = JsonDefaults.Web;

    public async Task UpsertAsync(
        string userId,
        UpsertFieldSyncStatusRequest request,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(userId)) return;

        if (request.PendingCount <= 0)
        {
            await ClearAsync(userId, cancellationToken);
            return;
        }

        var now = _time.UtcNow();
        var row = await db.FieldSyncStatuses
            .FirstOrDefaultAsync(x => x.UserId == userId, cancellationToken);

        var kindsJson = JsonSerializer.Serialize(
            request.Kinds?.Distinct(StringComparer.OrdinalIgnoreCase).ToArray()
                ?? Array.Empty<string>(),
            JsonOptions);

        if (row is null)
        {
            db.FieldSyncStatuses.Add(new FieldSyncStatus
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                DisplayName = request.DisplayName,
                RoleId = request.RoleId,
                PendingCount = request.PendingCount,
                OldestPendingAtUtc = request.OldestPendingAtUtc ?? now,
                LastSeenAtUtc = now,
                KindsJson = kindsJson,
            });
        }
        else
        {
            row.DisplayName = request.DisplayName ?? row.DisplayName;
            row.RoleId = request.RoleId ?? row.RoleId;
            row.PendingCount = request.PendingCount;
            row.OldestPendingAtUtc = request.OldestPendingAtUtc
                ?? row.OldestPendingAtUtc
                ?? now;
            row.LastSeenAtUtc = now;
            row.KindsJson = kindsJson;
        }

        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task ClearAsync(string userId, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(userId)) return;
        var rows = await db.FieldSyncStatuses
            .Where(x => x.UserId == userId)
            .ToListAsync(cancellationToken);
        if (rows.Count == 0) return;
        db.FieldSyncStatuses.RemoveRange(rows);
        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<FieldSyncStatusDto>> ListStaleAsync(
        CancellationToken cancellationToken = default)
    {
        var cutoff = _time.UtcNow() - StaleAfter;
        var rows = await db.FieldSyncStatuses.AsNoTracking()
            .Where(x => x.PendingCount > 0 && x.OldestPendingAtUtc != null && x.OldestPendingAtUtc < cutoff)
            .OrderBy(x => x.OldestPendingAtUtc)
            .ToListAsync(cancellationToken);

        return rows.Select(ToDto).ToList();
    }

    private FieldSyncStatusDto ToDto(FieldSyncStatus row)
    {
        var kinds = ParseKinds(row.KindsJson);
        double? ageHours = null;
        if (row.OldestPendingAtUtc is { } oldest)
            ageHours = Math.Round((_time.UtcNow() - oldest).TotalHours, 1);

        return new FieldSyncStatusDto
        {
            Id = row.Id,
            UserId = row.UserId,
            DisplayName = row.DisplayName,
            RoleId = row.RoleId,
            PendingCount = row.PendingCount,
            OldestPendingAtUtc = row.OldestPendingAtUtc,
            LastSeenAtUtc = row.LastSeenAtUtc,
            Kinds = kinds,
            AgeHours = ageHours,
            Stale = ageHours is >= 2,
        };
    }

    private static IReadOnlyList<string> ParseKinds(string json)
    {
        try
        {
            return JsonSerializer.Deserialize<string[]>(json, JsonOptions) ?? [];
        }
        catch
        {
            return [];
        }
    }
}