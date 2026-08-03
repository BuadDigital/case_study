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
        var pricing = new PartyFeePricingService(db);
        return Compose(db, new NullNotificationService(), new NotificationRecipientResolver(db), pricing);
    }

    public static WorkflowTaskService CreateWorkflow(ApplicationDbContext db)
    {
        var notifications = new NullNotificationService();
        var recipients = new NotificationRecipientResolver(db);
        var fees = Compose(db, notifications, recipients, new PartyFeePricingService(db));
        var timeline = new PropertyTimelineService(db);
        return ComposeWorkflow(db, fees, notifications, recipients, timeline);
    }

    public static WorkflowTaskService ComposeWorkflow(
        ApplicationDbContext db,
        IInspectorFeeService fees,
        INotificationService notifications,
        NotificationRecipientResolver recipients,
        IPropertyTimelineService timeline)
    {
        var query = new WorkflowTaskQueryService(db);
        var slots = new WorkflowTaskSlotSynchronizer(db, query);
        var distribution = new WorkflowTaskDistributionCommands(db, notifications, recipients, timeline);
        var cascade = new WorkflowTaskCascadeCleanup(db, fees);
        var lifecycle = new WorkflowTaskLifecycleCommands(db, fees, timeline, cascade, slots);
        return new WorkflowTaskService(query, slots, distribution, lifecycle);
    }

    public static (INotificationService Notifications, NotificationRecipientResolver Recipients)
        CreateNotificationDeps(ApplicationDbContext db)
    {
        return (new NullNotificationService(), new NotificationRecipientResolver(db));
    }

    public static InspectorFeeService Compose(
        ApplicationDbContext db,
        INotificationService notifications,
        NotificationRecipientResolver recipients,
        IPartyFeePricingService pricing)
    {
        var resolver = new InspectorFeeLedgerResolver(db);
        var writer = new InspectorFeeLedgerWriter(db, pricing, resolver);
        var summary = new InspectorFeeSummaryQuery(db, writer);
        var transitions = new InspectorFeeTransitionApplier(db);
        return new InspectorFeeService(
            db,
            notifications,
            recipients,
            pricing,
            resolver,
            writer,
            summary,
            transitions);
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
