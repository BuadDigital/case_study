using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Notifications;
using RealEstateEval.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

internal static class TestInspectorFeeServiceFactory
{
    public static InspectorFeeService Create(ApplicationDbContext db)
    {
        return new InspectorFeeService(
            db,
            new NullNotificationService(),
            new NotificationRecipientResolver(db),
            new PartyFeePricingService(db));
    }

    public static WorkflowTaskService CreateWorkflow(ApplicationDbContext db)
    {
        var notifications = new NullNotificationService();
        var recipients = new NotificationRecipientResolver(db);
        var fees = new InspectorFeeService(
            db,
            notifications,
            recipients,
            new PartyFeePricingService(db));
        var timeline = new PropertyTimelineService(db);
        return new WorkflowTaskService(db, fees, notifications, recipients, timeline);
    }

    public static (INotificationService Notifications, NotificationRecipientResolver Recipients)
        CreateNotificationDeps(ApplicationDbContext db)
    {
        return (new NullNotificationService(), new NotificationRecipientResolver(db));
    }

    private sealed class NullNotificationService : INotificationService
    {
        public Task<IReadOnlyList<UserNotificationDto>> ListForUserAsync(
            string userId,
            CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<UserNotificationDto>>([]);

        public Task<UserNotificationDto> CreateForUserAsync(
            string userId,
            CreateUserNotificationRequest request,
            CancellationToken cancellationToken = default) =>
            Task.FromResult(new UserNotificationDto { Title = request.Title });

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

}
