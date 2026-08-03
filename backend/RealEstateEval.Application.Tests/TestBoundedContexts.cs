using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.Storage;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Notifications;
using RealEstateEval.Infrastructure.Services;
using RealEstateEval.Application.Abstractions;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// Shared InMemory roots so legacy + Failures + Operations contexts see the same rows
/// (extraction step 3 dual write).
/// </summary>
internal static class TestBoundedContexts
{
    public sealed record Bundle(
        ApplicationDbContext App,
        FailuresDbContext Failures,
        OperationsDbContext Ops,
        string DatabaseName,
        InMemoryDatabaseRoot Root);

    public static Bundle Create(string? name = null)
    {
        name ??= $"ree-test-{Guid.NewGuid():N}";
        var root = new InMemoryDatabaseRoot();

        var app = new ApplicationDbContext(
            new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(name, root)
                .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
                .Options);

        var failures = new FailuresDbContext(
            new DbContextOptionsBuilder<FailuresDbContext>()
                .UseInMemoryDatabase(name, root)
                .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
                .Options);

        var ops = new OperationsDbContext(
            new DbContextOptionsBuilder<OperationsDbContext>()
                .UseInMemoryDatabase(name, root)
                .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
                .Options);

        return new Bundle(app, failures, ops, name, root);
    }

    /// <summary>
    /// Pair Failures/Operations contexts to an existing ApplicationDbContext that already used
    /// a plain <c>UseInMemoryDatabase(name)</c> (no shared root). Prefer <see cref="Create"/> for
    /// new fixtures; this reuses the same name string only when the app context was built without
    /// a root, which cannot share stores — so always create a full <see cref="Bundle"/> instead.
    /// </summary>
    public static (FailuresDbContext Failures, OperationsDbContext Ops) SiblingContexts(
        string databaseName,
        InMemoryDatabaseRoot? root = null)
    {
        root ??= new InMemoryDatabaseRoot();
        var failures = new FailuresDbContext(
            new DbContextOptionsBuilder<FailuresDbContext>()
                .UseInMemoryDatabase(databaseName, root)
                .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
                .Options);
        var ops = new OperationsDbContext(
            new DbContextOptionsBuilder<OperationsDbContext>()
                .UseInMemoryDatabase(databaseName, root)
                .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
                .Options);
        return (failures, ops);
    }

    public static FailureService CreateFailureService(
        Bundle bundle,
        IWorkflowTaskService? tasks = null,
        IPropertyTimelineService? timeline = null,
        INotificationService? notifications = null,
        NotificationRecipientResolver? recipients = null)
    {
        timeline ??= new PropertyTimelineService(bundle.App);
        notifications ??= new NullNotificationService();
        recipients ??= new NotificationRecipientResolver(bundle.App);
        tasks ??= TestInspectorFeeServiceFactory.CreateWorkflow(bundle.App);
        return new FailureService(
            bundle.Failures,
            bundle.App,
            tasks,
            timeline,
            notifications,
            recipients);
    }

    public static FailureService CreateFailureService(
        ApplicationDbContext app,
        FailuresDbContext failures,
        IWorkflowTaskService? tasks = null,
        IPropertyTimelineService? timeline = null,
        INotificationService? notifications = null,
        NotificationRecipientResolver? recipients = null)
    {
        timeline ??= new PropertyTimelineService(app);
        notifications ??= new NullNotificationService();
        recipients ??= new NotificationRecipientResolver(app);
        tasks ??= TestInspectorFeeServiceFactory.CreateWorkflow(app);
        return new FailureService(failures, app, tasks, timeline, notifications, recipients);
    }

    public static KeyEnvelopesService CreateKeyEnvelopesService(Bundle bundle) =>
        new(
            bundle.Ops,
            bundle.App,
            new PropertyAccessHoldService(bundle.App, bundle.Failures),
            new KeyEnvelopePeopleResolver(bundle.App));

    public static KeyEnvelopesService CreateKeyEnvelopesService(
        ApplicationDbContext app,
        FailuresDbContext failures,
        OperationsDbContext ops) =>
        new(
            ops,
            app,
            new PropertyAccessHoldService(app, failures),
            new KeyEnvelopePeopleResolver(app));

    public static PropertyKeyGateResolver CreateKeyGate(Bundle bundle) =>
        new(bundle.Ops, bundle.App);

    public static PropertyKeysService CreatePropertyKeys(Bundle bundle) =>
        new(bundle.Ops, bundle.App);

    public static OperationsTaskService CreateOperationsTasks(
        Bundle bundle,
        INotificationService? notifications = null,
        IPartyFeePricingService? pricing = null) =>
        OperationsTaskService.Create(
            bundle.Ops,
            bundle.App,
            notifications ?? new NullNotificationService(),
            pricing ?? new PartyFeePricingService(bundle.App));

    private sealed class NullNotificationService : INotificationService
    {
        public Task<IReadOnlyList<Application.Contracts.UserNotificationDto>> ListForUserAsync(
            string userId,
            CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<Application.Contracts.UserNotificationDto>>([]);

        public Task<Application.Contracts.UserNotificationDto> CreateForUserAsync(
            string userId,
            Application.Contracts.CreateUserNotificationRequest request,
            CancellationToken cancellationToken = default) =>
            Task.FromResult(new Application.Contracts.UserNotificationDto { Title = request.Title });

        public Task<int> CreateForUsersAsync(
            IReadOnlyCollection<string> userIds,
            Application.Contracts.CreateUserNotificationRequest request,
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
