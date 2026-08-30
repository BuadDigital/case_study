using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Notifications;
using RealEstateEval.Platform.Application.Abstractions;
using RealEstateEval.Platform.Infrastructure.Notifications;
using RealEstateEval.Platform.Application.Contracts;

namespace RealEstateEval.Platform.Infrastructure.Services;

public sealed class PushSubscriptionService : IPushSubscriptionService
{
    private readonly MessagingDbContext _db;
    private readonly WebPushOptions _options;
    private readonly TimeProvider _time;

    public PushSubscriptionService(
        MessagingDbContext db,
        IOptions<WebPushOptions> options,
        TimeProvider? time = null)
    {
        _time = time ?? TimeProvider.System;

        _db = db;
        _options = options.Value;
    }

    public Task<PushConfigDto> GetConfigAsync(CancellationToken cancellationToken = default)
    {
        var enabled = _options.Enabled && !string.IsNullOrWhiteSpace(_options.PublicKey);
        return Task.FromResult(new PushConfigDto(
            enabled,
            enabled ? _options.PublicKey : null));
    }

    public async Task<IReadOnlyList<PushSubscriptionDto>> ListForUserAsync(
        string userId,
        CancellationToken cancellationToken = default)
    {
        var rows = await _db.PushSubscriptions.AsNoTracking()
            .Where(x => x.UserId == userId)
            .OrderByDescending(x => x.LastSeenAtUtc)
            .ToListAsync(cancellationToken);
        return rows.Select(ToDto).ToList();
    }

    public async Task<PushSubscriptionDto> UpsertAsync(
        string userId,
        RegisterPushSubscriptionRequest request,
        CancellationToken cancellationToken = default)
    {
        var endpoint = request.Endpoint.Trim();
        if (string.IsNullOrWhiteSpace(endpoint) ||
            string.IsNullOrWhiteSpace(request.P256dh) ||
            string.IsNullOrWhiteSpace(request.Auth))
        {
            throw new ArgumentException("endpoint, p256dh, and auth are required");
        }

        var now = _time.UtcNow();
        var existing = await _db.PushSubscriptions
            .FirstOrDefaultAsync(x => x.Endpoint == endpoint, cancellationToken);

        if (existing is null)
        {
            existing = new PushSubscription
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                Endpoint = endpoint,
                P256dh = request.P256dh.Trim(),
                Auth = request.Auth.Trim(),
                UserAgent = TrimOrNull(request.UserAgent, 512),
                DeviceLabel = TrimOrNull(request.DeviceLabel, 128),
                CreatedAtUtc = now,
                LastSeenAtUtc = now,
            };
            _db.PushSubscriptions.Add(existing);
        }
        else
        {
 // Rebind shared-device endpoints to the current caller.
            existing.UserId = userId;
            existing.P256dh = request.P256dh.Trim();
            existing.Auth = request.Auth.Trim();
            existing.UserAgent = TrimOrNull(request.UserAgent, 512) ?? existing.UserAgent;
            existing.DeviceLabel = TrimOrNull(request.DeviceLabel, 128) ?? existing.DeviceLabel;
            existing.LastSeenAtUtc = now;
            existing.DisabledAtUtc = null;
            existing.DisabledReason = null;
            existing.ConsecutiveFailures = 0;
        }

        await _db.SaveChangesAsync(cancellationToken);
        return ToDto(existing);
    }

    public async Task<bool> DeleteAsync(
        string userId,
        string endpoint,
        CancellationToken cancellationToken = default)
    {
        var row = await _db.PushSubscriptions
            .FirstOrDefaultAsync(
                x => x.UserId == userId && x.Endpoint == endpoint.Trim(),
                cancellationToken);
        if (row is null) return false;
        _db.PushSubscriptions.Remove(row);
        await _db.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<PushPreferenceDto> GetPreferenceAsync(
        string userId,
        CancellationToken cancellationToken = default)
    {
        var row = await _db.PushPreferences.AsNoTracking()
            .FirstOrDefaultAsync(x => x.UserId == userId, cancellationToken);
        return new PushPreferenceDto(row?.PushEnabled ?? true);
    }

    public async Task<PushPreferenceDto> SetPreferenceAsync(
        string userId,
        bool enabled,
        CancellationToken cancellationToken = default)
    {
        var row = await _db.PushPreferences
            .FirstOrDefaultAsync(x => x.UserId == userId, cancellationToken);
        if (row is null)
        {
            row = new PushPreference
            {
                UserId = userId,
                PushEnabled = enabled,
                UpdatedAtUtc = _time.UtcNow(),
            };
            _db.PushPreferences.Add(row);
        }
        else
        {
            row.PushEnabled = enabled;
            row.UpdatedAtUtc = _time.UtcNow();
        }

        await _db.SaveChangesAsync(cancellationToken);
        return new PushPreferenceDto(row.PushEnabled);
    }

    private static PushSubscriptionDto ToDto(PushSubscription row) =>
        new(
            row.Id,
            row.Endpoint,
            row.UserAgent,
            row.DeviceLabel,
            row.CreatedAtUtc,
            row.LastSeenAtUtc,
            row.DisabledAtUtc);

    private static string? TrimOrNull(string? value, int max)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var trimmed = value.Trim();
        return trimmed.Length <= max ? trimmed : trimmed[..max];
    }
}
