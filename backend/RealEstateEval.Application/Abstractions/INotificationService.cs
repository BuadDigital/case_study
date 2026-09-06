using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Application.Abstractions;

public interface INotificationService
{
    Task<IReadOnlyList<UserNotificationDto>> ListForUserAsync(
        string userId,
        CancellationToken cancellationToken = default);

    /// <summary>Filtered / sorted plain list. Paging members of the query are ignored here.</summary>
    Task<IReadOnlyList<UserNotificationDto>> ListForUserAsync(
        string userId,
        NotificationListQuery query,
        CancellationToken cancellationToken = default);

    /// <summary>Filtered / sorted page for one user. See docs/architecture/pagination-contract.md §6.</summary>
    Task<PagedResultDto<UserNotificationDto>> ListPagedForUserAsync(
        string userId,
        NotificationListQuery query,
        int skip,
        int take,
        int page,
        CancellationToken cancellationToken = default);

    Task<UserNotificationDto> CreateForUserAsync(
        string userId,
        CreateUserNotificationRequest request,
        CancellationToken cancellationToken = default);

    Task<int> CreateForUsersAsync(
        IReadOnlyCollection<string> userIds,
        CreateUserNotificationRequest request,
        CancellationToken cancellationToken = default);

    async Task<int> CreateForUsersAsync(
        IReadOnlyDictionary<string, CreateUserNotificationRequest> requestsByUser,
        CancellationToken cancellationToken = default)
    {
        var created = 0;
        foreach (var (userId, request) in requestsByUser)
        {
            await CreateForUserAsync(userId, request, cancellationToken);
            created++;
        }

        return created;
    }

    async Task<int> CreateManyAsync(
        IReadOnlyCollection<(string UserId, CreateUserNotificationRequest Request)> notifications,
        CancellationToken cancellationToken = default)
    {
        var created = 0;
        foreach (var (userId, request) in notifications)
        {
            await CreateForUserAsync(userId, request, cancellationToken);
            created++;
        }

        return created;
    }

    Task<bool> MarkReadAsync(
        string userId,
        Guid id,
        CancellationToken cancellationToken = default);

    Task MarkAllReadAsync(string userId, CancellationToken cancellationToken = default);

    Task<bool> DeleteAsync(
        string userId,
        Guid id,
        CancellationToken cancellationToken = default);

    Task ClearForUserAsync(string userId, CancellationToken cancellationToken = default);
}
