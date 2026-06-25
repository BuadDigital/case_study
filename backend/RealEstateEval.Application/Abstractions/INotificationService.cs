using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Application.Abstractions;

public interface INotificationService
{
    Task<IReadOnlyList<UserNotificationDto>> ListForUserAsync(
        string userId,
        CancellationToken cancellationToken = default);

    Task<UserNotificationDto> CreateForUserAsync(
        string userId,
        CreateUserNotificationRequest request,
        CancellationToken cancellationToken = default);

    Task<int> CreateForUsersAsync(
        IReadOnlyCollection<string> userIds,
        CreateUserNotificationRequest request,
        CancellationToken cancellationToken = default);

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
