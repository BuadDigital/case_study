using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Infrastructure.Services;

/// <summary>
/// Financial host has no Messaging outbox. Fee/billing notifications stay a leftover until
/// Platform HTTP dispatch exists; Case Study still notifies on its own workflow paths.
/// </summary>
public sealed class NullNotificationService : INotificationService
{
    public Task<IReadOnlyList<UserNotificationDto>> ListForUserAsync(
        string userId,
        CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<UserNotificationDto>>([]);

    public Task<UserNotificationDto> CreateForUserAsync(
        string userId,
        CreateUserNotificationRequest request,
        CancellationToken cancellationToken = default) =>
        Task.FromResult(new UserNotificationDto { Title = request.Title, Body = request.Body });

    public Task<int> CreateForUsersAsync(
        IReadOnlyCollection<string> userIds,
        CreateUserNotificationRequest request,
        CancellationToken cancellationToken = default) =>
        Task.FromResult(0);

    public Task<bool> MarkReadAsync(
        string userId,
        Guid id,
        CancellationToken cancellationToken = default) =>
        Task.FromResult(false);

    public Task MarkAllReadAsync(string userId, CancellationToken cancellationToken = default) =>
        Task.CompletedTask;

    public Task<bool> DeleteAsync(
        string userId,
        Guid id,
        CancellationToken cancellationToken = default) =>
        Task.FromResult(false);

    public Task ClearForUserAsync(string userId, CancellationToken cancellationToken = default) =>
        Task.CompletedTask;
}
