using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Shared.Contracts;

namespace RealEstateEval.Infrastructure.Integration;

/// <summary>
/// Transitional command-side adapter for services that do not own the notification inbox.
/// It writes requests to the shared transactional outbox; Platform persists the inbox rows.
/// The shared database and its single Case Study outbox dispatcher remain explicit until
/// service databases are physically separated.
/// </summary>
public sealed class PlatformNotificationRequestService(
    ApplicationDbContext db,
    IIntegrationEventPublisher events) : INotificationService
{
    public Task<IReadOnlyList<UserNotificationDto>> ListForUserAsync(
        string userId,
        CancellationToken cancellationToken = default) =>
        throw OwnerOnly();

    public async Task<UserNotificationDto> CreateForUserAsync(
        string userId,
        CreateUserNotificationRequest request,
        CancellationToken cancellationToken = default)
    {
        await QueueAsync([userId], request, cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        return ToProvisionalDto(request);
    }

    public async Task<int> CreateForUsersAsync(
        IReadOnlyCollection<string> userIds,
        CreateUserNotificationRequest request,
        CancellationToken cancellationToken = default)
    {
        var recipients = NormalizeRecipients(userIds);
        if (recipients.Count == 0) return 0;

        await QueueAsync(recipients, request, cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        return recipients.Count;
    }

    public async Task<int> CreateForUsersAsync(
        IReadOnlyDictionary<string, CreateUserNotificationRequest> requestsByUser,
        CancellationToken cancellationToken = default)
    {
        var notifications = requestsByUser
            .Select(entry => (entry.Key, entry.Value))
            .ToList();
        return await CreateManyAsync(notifications, cancellationToken);
    }

    public async Task<int> CreateManyAsync(
        IReadOnlyCollection<(string UserId, CreateUserNotificationRequest Request)> notifications,
        CancellationToken cancellationToken = default)
    {
        var normalized = notifications
            .Where(item => !string.IsNullOrWhiteSpace(item.UserId))
            .GroupBy(item => item.UserId.Trim(), StringComparer.Ordinal)
            .Select(group => group.Last())
            .ToList();
        if (normalized.Count == 0) return 0;

        foreach (var item in normalized)
            await QueueAsync([item.UserId.Trim()], item.Request, cancellationToken);

        await db.SaveChangesAsync(cancellationToken);
        return normalized.Count;
    }

    public Task<bool> MarkReadAsync(
        string userId,
        Guid id,
        CancellationToken cancellationToken = default) =>
        throw OwnerOnly();

    public Task MarkAllReadAsync(
        string userId,
        CancellationToken cancellationToken = default) =>
        throw OwnerOnly();

    public Task<bool> DeleteAsync(
        string userId,
        Guid id,
        CancellationToken cancellationToken = default) =>
        throw OwnerOnly();

    public Task ClearForUserAsync(
        string userId,
        CancellationToken cancellationToken = default) =>
        throw OwnerOnly();

    private Task QueueAsync(
        IReadOnlyList<string> userIds,
        CreateUserNotificationRequest request,
        CancellationToken cancellationToken) =>
        events.PublishAsync(
            IntegrationEventTypes.NotificationUsersRequested,
            new NotificationUsersRequestedPayload(
                userIds,
                request.Title,
                request.Body,
                request.Href,
                NotificationContract.Tones.Normalize(request.Tone),
                NotificationContract.Categories.Normalize(request.Category),
                NotificationContract.EntityTypes.Normalize(request.EntityType),
                request.EntityId,
                request.Actor,
                request.SourceEvent),
            cancellationToken);

    private static List<string> NormalizeRecipients(IEnumerable<string> userIds) =>
        userIds
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Select(id => id.Trim())
            .Distinct(StringComparer.Ordinal)
            .ToList();

    private static UserNotificationDto ToProvisionalDto(CreateUserNotificationRequest request) =>
        new()
        {
            Id = Guid.Empty,
            Title = request.Title,
            Body = request.Body,
            Href = request.Href,
            Tone = NotificationContract.Tones.Normalize(request.Tone),
            Category = NotificationContract.Categories.Normalize(request.Category),
            EntityType = NotificationContract.EntityTypes.Normalize(request.EntityType),
            EntityId = request.EntityId,
            Actor = request.Actor,
            SourceEvent = request.SourceEvent,
            CreatedAtUtc = DateTime.UtcNow,
            Read = false,
        };

    private static InvalidOperationException OwnerOnly() =>
        new("Notification inbox reads and mutations are owned by Platform.");
}
