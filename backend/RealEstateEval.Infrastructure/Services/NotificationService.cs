using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Shared.Contracts;

namespace RealEstateEval.Infrastructure.Services;

public sealed class NotificationService : INotificationService
{
    private const int MaxItemsPerUser = 50;
    private static readonly TimeSpan DedupeWindow = TimeSpan.FromSeconds(30);

    private readonly ApplicationDbContext _db;
    private readonly IIntegrationEventPublisher _events;
    private readonly INotificationRealtimePublisher _realtime;

    public NotificationService(
        ApplicationDbContext db,
        IIntegrationEventPublisher events,
        INotificationRealtimePublisher realtime)
    {
        _db = db;
        _events = events;
        _realtime = realtime;
    }

    public async Task<IReadOnlyList<UserNotificationDto>> ListForUserAsync(
        string userId,
        CancellationToken cancellationToken = default)
    {
        var rows = await _db.UserNotifications.AsNoTracking()
            .Where(n => n.UserId == userId)
            .OrderByDescending(n => n.CreatedAtUtc)
            .Take(MaxItemsPerUser)
            .ToListAsync(cancellationToken);

        return rows.Select(ToDto).ToList();
    }

    public async Task<UserNotificationDto> CreateForUserAsync(
        string userId,
        CreateUserNotificationRequest request,
        CancellationToken cancellationToken = default)
    {
        var row = await UpsertForUserAsync(userId, request, cancellationToken);
        await TrimUserNotificationsAsync(userId, cancellationToken);
        var dto = ToDto(row);
        _realtime.Publish(userId, dto);
        return dto;
    }

    public async Task<int> CreateForUsersAsync(
        IReadOnlyCollection<string> userIds,
        CreateUserNotificationRequest request,
        CancellationToken cancellationToken = default)
    {
        var distinct = userIds
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Distinct(StringComparer.Ordinal)
            .ToList();

        if (distinct.Count == 0) return 0;

        var created = 0;
        foreach (var userId in distinct)
        {
            var row = await UpsertForUserAsync(userId, request, cancellationToken);
            await TrimUserNotificationsAsync(userId, cancellationToken);
            _realtime.Publish(userId, ToDto(row));
            created++;
        }

        return created;
    }

    public async Task<bool> MarkReadAsync(
        string userId,
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var row = await _db.UserNotifications
            .FirstOrDefaultAsync(n => n.Id == id && n.UserId == userId, cancellationToken);
        if (row is null) return false;

        if (row.ReadAtUtc is null)
        {
            row.ReadAtUtc = DateTime.UtcNow;
            await _db.SaveChangesAsync(cancellationToken);
        }

        return true;
    }

    public async Task MarkAllReadAsync(string userId, CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        await _db.UserNotifications
            .Where(n => n.UserId == userId && n.ReadAtUtc == null)
            .ExecuteUpdateAsync(
                s => s.SetProperty(n => n.ReadAtUtc, now),
                cancellationToken);
    }

    public async Task<bool> DeleteAsync(
        string userId,
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var deleted = await _db.UserNotifications
            .Where(n => n.Id == id && n.UserId == userId)
            .ExecuteDeleteAsync(cancellationToken);
        return deleted > 0;
    }

    public async Task ClearForUserAsync(string userId, CancellationToken cancellationToken = default)
    {
        await _db.UserNotifications
            .Where(n => n.UserId == userId)
            .ExecuteDeleteAsync(cancellationToken);
    }

    private async Task<UserNotification> UpsertForUserAsync(
        string userId,
        CreateUserNotificationRequest request,
        CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;

        if (!string.IsNullOrWhiteSpace(request.SourceEvent))
        {
            var cutoff = now - DedupeWindow;
            var existing = await _db.UserNotifications
                .Where(n => n.UserId == userId)
                .Where(n => n.SourceEvent == request.SourceEvent)
                .Where(n => n.ReadAtUtc == null)
                .Where(n => n.CreatedAtUtc >= cutoff)
                .OrderByDescending(n => n.CreatedAtUtc)
                .FirstOrDefaultAsync(cancellationToken);

            if (existing is not null)
            {
                existing.Title = request.Title;
                existing.Body = request.Body;
                existing.Href = request.Href;
                existing.Tone = request.Tone;
                existing.Category = request.Category;
                existing.EntityType = request.EntityType;
                existing.EntityId = request.EntityId;
                existing.Actor = request.Actor;
                existing.CreatedAtUtc = now;
                await QueueNotificationCreatedEventAsync(userId, existing, cancellationToken);
                await _db.SaveChangesAsync(cancellationToken);
                return existing;
            }
        }

        var row = new UserNotification
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Title = request.Title,
            Body = request.Body,
            Href = request.Href,
            Tone = request.Tone,
            Category = request.Category,
            EntityType = request.EntityType,
            EntityId = request.EntityId,
            Actor = request.Actor,
            SourceEvent = request.SourceEvent,
            CreatedAtUtc = now,
        };
        _db.UserNotifications.Add(row);
        await QueueNotificationCreatedEventAsync(userId, row, cancellationToken);
        await _db.SaveChangesAsync(cancellationToken);
        return row;
    }

    private async Task QueueNotificationCreatedEventAsync(
        string userId,
        UserNotification row,
        CancellationToken cancellationToken)
    {
        await _events.PublishAsync(
            IntegrationEventTypes.NotificationUserCreated,
            new NotificationUserCreatedPayload(
                userId,
                row.Id,
                row.Title,
                row.Body,
                row.Href,
                row.Tone,
                row.Category,
                row.EntityType,
                row.EntityId,
                row.Actor,
                row.SourceEvent,
                row.CreatedAtUtc,
                row.ReadAtUtc is not null),
            cancellationToken);
    }

    private async Task TrimUserNotificationsAsync(
        string userId,
        CancellationToken cancellationToken)
    {
        var overflowIds = await _db.UserNotifications.AsNoTracking()
            .Where(n => n.UserId == userId)
            .OrderByDescending(n => n.CreatedAtUtc)
            .Skip(MaxItemsPerUser)
            .Select(n => n.Id)
            .ToListAsync(cancellationToken);

        if (overflowIds.Count == 0) return;

        await _db.UserNotifications
            .Where(n => overflowIds.Contains(n.Id))
            .ExecuteDeleteAsync(cancellationToken);
    }

    private static UserNotificationDto ToDto(UserNotification row) => new()
    {
        Id = row.Id,
        Title = row.Title,
        Body = row.Body,
        Href = row.Href,
        Tone = row.Tone,
        Category = row.Category,
        EntityType = row.EntityType,
        EntityId = row.EntityId,
        Actor = row.Actor,
        SourceEvent = row.SourceEvent,
        CreatedAtUtc = row.CreatedAtUtc,
        Read = row.ReadAtUtc is not null,
    };
}
