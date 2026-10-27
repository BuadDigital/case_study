using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Application.Tests;

/// <summary>Records every notice and its recipients; reads return nothing.</summary>
public sealed class RecordingNotifications : INotificationService
{
    public List<CreateUserNotificationRequest> Sent { get; } = [];
    public List<string> Recipients { get; } = [];

    public Task<UserNotificationDto> CreateForUserAsync(
        string userId,
        CreateUserNotificationRequest request,
        CancellationToken cancellationToken = default)
    {
        Sent.Add(request);
        Recipients.Add(userId);
        return Task.FromResult(new UserNotificationDto { Title = request.Title });
    }

    public Task<int> CreateForUsersAsync(
        IReadOnlyCollection<string> userIds,
        CreateUserNotificationRequest request,
        CancellationToken cancellationToken = default)
    {
        Sent.Add(request);
        Recipients.AddRange(userIds);
        return Task.FromResult(userIds.Count);
    }

    public Task<IReadOnlyList<UserNotificationDto>> ListForUserAsync(
        string userId,
        CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<UserNotificationDto>>([]);

    public Task<IReadOnlyList<UserNotificationDto>> ListForUserAsync(
        string userId,
        NotificationListQuery query,
        CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<UserNotificationDto>>([]);

    public Task<PagedResultDto<UserNotificationDto>> ListPagedForUserAsync(
        string userId,
        NotificationListQuery query,
        int skip,
        int take,
        int page,
        CancellationToken cancellationToken = default) =>
        Task.FromResult(new PagedResultDto<UserNotificationDto>
        {
            Items = [],
            TotalCount = 0,
            Page = page,
            PageSize = take,
        });

    public Task<bool> MarkReadAsync(
        string userId,
        Guid id,
        CancellationToken cancellationToken = default) => Task.FromResult(false);

    public Task MarkAllReadAsync(string userId, CancellationToken cancellationToken = default) =>
        Task.CompletedTask;

    public Task<bool> DeleteAsync(
        string userId,
        Guid id,
        CancellationToken cancellationToken = default) => Task.FromResult(false);

    public Task ClearForUserAsync(string userId, CancellationToken cancellationToken = default) =>
        Task.CompletedTask;
}
