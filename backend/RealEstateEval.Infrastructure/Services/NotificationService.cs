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

    private readonly ApplicationDbContext _db;
    private readonly IIntegrationEventPublisher _events;

    public NotificationService(
        ApplicationDbContext db,
        IIntegrationEventPublisher events)
    {
        _db = db;
        _events = events;
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
        var rows = await CreateBatchAsync(
            [new KeyValuePair<string, CreateUserNotificationRequest>(userId, request)],
            cancellationToken);
        var row = rows.Single();
        return ToDto(row);
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

        var requestsByUser = distinct.ToDictionary(
            userId => userId,
            _ => request,
            StringComparer.Ordinal);
        return await CreateForUsersAsync(requestsByUser, cancellationToken);
    }

    public async Task<int> CreateForUsersAsync(
        IReadOnlyDictionary<string, CreateUserNotificationRequest> requestsByUser,
        CancellationToken cancellationToken = default)
    {
        var normalized = requestsByUser
            .Where(entry => !string.IsNullOrWhiteSpace(entry.Key))
            .ToDictionary(entry => entry.Key, entry => entry.Value, StringComparer.Ordinal);
        return await CreateManyAsync(
            normalized.Select(entry => (entry.Key, entry.Value)).ToList(),
            cancellationToken);
    }

    public async Task<int> CreateManyAsync(
        IReadOnlyCollection<(string UserId, CreateUserNotificationRequest Request)> notifications,
        CancellationToken cancellationToken = default)
    {
        var normalized = notifications
            .Where(notification => !string.IsNullOrWhiteSpace(notification.UserId))
            .Select(notification =>
                new KeyValuePair<string, CreateUserNotificationRequest>(
                    notification.UserId,
                    notification.Request))
            .ToList();
        if (normalized.Count == 0) return 0;

        var rows = await CreateBatchAsync(normalized, cancellationToken);
        return rows.Count;
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

    private async Task<IReadOnlyList<UserNotification>> CreateBatchAsync(
        IReadOnlyCollection<KeyValuePair<string, CreateUserNotificationRequest>> requestsByUser,
        CancellationToken cancellationToken)
    {
        var checkpoint = ChangeTrackerCheckpoint.Capture(_db);
        try
        {
            return await StageBatchAsync(requestsByUser, cancellationToken);
        }
        catch (DbUpdateException ex) when (
            PostgresErrors.IsUniqueViolation(
                ex,
                DatabaseIndexNames.UserNotificationUnreadSourceEvent)
            && _db.Database.CurrentTransaction is null)
        {
            // A concurrent delivery of the same event inserted the row first. The failed
            // statement rolled back, so undo the staged work and redo it: the second pass
            // reads the winning row and refreshes it instead of inserting a duplicate.
            checkpoint.Rollback();
            return await StageBatchAsync(requestsByUser, cancellationToken);
        }
    }

    private async Task<IReadOnlyList<UserNotification>> StageBatchAsync(
        IReadOnlyCollection<KeyValuePair<string, CreateUserNotificationRequest>> requestsByUser,
        CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var userIds = requestsByUser
            .Select(entry => entry.Key)
            .Distinct(StringComparer.Ordinal)
            .ToList();
        var existingRows = await _db.UserNotifications
            .Where(n => userIds.Contains(n.UserId))
            .ToListAsync(cancellationToken);
        var result = new List<UserNotification>(userIds.Count);

        foreach (var (userId, request) in requestsByUser)
        {
            UserNotification? row = null;
            if (!string.IsNullOrWhiteSpace(request.SourceEvent))
            {
                // Must match IX_UserNotifications_UserId_SourceEvent_Unread exactly, or a
                // resend the probe considers new is rejected by the index instead.
                row = existingRows
                    .Where(n => n.UserId == userId)
                    .Where(n => n.SourceEvent == request.SourceEvent)
                    .Where(n => n.ReadAtUtc == null)
                    .OrderByDescending(n => n.CreatedAtUtc)
                    .FirstOrDefault();
            }

            if (row is not null)
            {
                row.Title = request.Title;
                row.Body = request.Body;
                row.Href = request.Href;
                row.Tone = NotificationContract.Tones.Normalize(request.Tone);
                row.Category = NotificationContract.Categories.Normalize(request.Category);
                row.EntityType = NotificationContract.EntityTypes.Normalize(request.EntityType);
                row.EntityId = request.EntityId;
                row.Actor = request.Actor;
                row.CreatedAtUtc = now;
            }
            else
            {
                row = new UserNotification
                {
                    Id = Guid.NewGuid(),
                    UserId = userId,
                    Title = request.Title,
                    Body = request.Body,
                    Href = request.Href,
                    Tone = NotificationContract.Tones.Normalize(request.Tone),
                    Category = NotificationContract.Categories.Normalize(request.Category),
                    EntityType = NotificationContract.EntityTypes.Normalize(request.EntityType),
                    EntityId = request.EntityId,
                    Actor = request.Actor,
                    SourceEvent = request.SourceEvent,
                    CreatedAtUtc = now,
                };
                _db.UserNotifications.Add(row);
                existingRows.Add(row);
            }

            await QueueNotificationCreatedEventAsync(userId, row, cancellationToken);
            result.Add(row);
        }

        var overflow = existingRows
            .GroupBy(n => n.UserId, StringComparer.Ordinal)
            .SelectMany(g => g.OrderByDescending(n => n.CreatedAtUtc).Skip(MaxItemsPerUser))
            .ToList();
        _db.UserNotifications.RemoveRange(overflow);

        await _db.SaveChangesAsync(cancellationToken);
        return result;
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

    private static UserNotificationDto ToDto(UserNotification row) => new()
    {
        Id = row.Id,
        Title = row.Title,
        Body = row.Body,
        Href = row.Href,
        Tone = NotificationContract.Tones.Normalize(row.Tone),
        Category = NotificationContract.Categories.Normalize(row.Category),
        EntityType = NotificationContract.EntityTypes.Normalize(row.EntityType),
        EntityId = row.EntityId,
        Actor = row.Actor,
        SourceEvent = row.SourceEvent,
        CreatedAtUtc = row.CreatedAtUtc,
        Read = row.ReadAtUtc is not null,
    };
}
