using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.Storage;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Notifications;
using RealEstateEval.Infrastructure.Services;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Failures.Infrastructure.Data.Contexts;
using RealEstateEval.Operations.Infrastructure.Data.Contexts;
using RealEstateEval.Failures.Infrastructure.Services;
using RealEstateEval.Operations.Infrastructure.Services;
using RealEstateEval.CaseStudy.Infrastructure.Data.Contexts;
using RealEstateEval.CaseStudy.Infrastructure.Services;
using RealEstateEval.Identity.Infrastructure.Services;
using RealEstateEval.Financial.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// Shared InMemory roots so legacy + Failures + Operations contexts see the same rows
/// (extraction dual write).
/// </summary>
internal static class TestBoundedContexts
{
    public sealed record Bundle(
        CaseStudyDbContext CaseStudy,
        FailuresDbContext Failures,
        OperationsDbContext Ops,
        string DatabaseName,
        InMemoryDatabaseRoot Root);

    public static Bundle Create(string? name = null)
    {
        name ??= $"ree-test-{Guid.NewGuid():N}";
        var root = new InMemoryDatabaseRoot();

        var caseStudy = new CaseStudyDbContext(
            new DbContextOptionsBuilder<CaseStudyDbContext>()
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

        return new Bundle(caseStudy, failures, ops, name, root);
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
        IWorkflowTaskShellPatcher? tasks = null,
        IPropertyTimelineService? timeline = null,
        INotificationService? notifications = null,
        NotificationRecipientResolver? recipients = null,
        IUserLabelLookup? labels = null)
    {
        var cs = bundle.CaseStudy;
        var identity = TestInspectorFeeServiceFactory.ShareIdentity(cs);
        timeline ??= new PropertyTimelineService(cs, new FailureLookup(bundle.Failures));
        notifications ??= new NullNotificationService();
        recipients ??= TestNotificationRecipients.ForContexts(cs, identity);
        tasks ??= new WorkflowTaskShellPatcher(cs);
        labels ??= new UserLabelLookup(identity);
        return new FailureService(
            bundle.Failures,
            new CaseStudyLookup(cs),
            new CaseStudyFailureCommands(cs, tasks, timeline),
            notifications,
            recipients,
            labels);
    }

    public static FailureService CreateFailureService(
        DbContext app,
        FailuresDbContext failures,
        IWorkflowTaskShellPatcher? tasks = null,
        IPropertyTimelineService? timeline = null,
        INotificationService? notifications = null,
        NotificationRecipientResolver? recipients = null,
        IUserLabelLookup? labels = null)
    {
        var cs = TestInspectorFeeServiceFactory.ShareCaseStudy(app);
        var identity = TestInspectorFeeServiceFactory.ShareIdentity(app);
        timeline ??= new PropertyTimelineService(cs, new FailureLookup(failures));
        notifications ??= new NullNotificationService();
        recipients ??= TestNotificationRecipients.ForContexts(cs, identity);
        tasks ??= new WorkflowTaskShellPatcher(cs);
        labels ??= new UserLabelLookup(identity);
        return new FailureService(
            failures,
            new CaseStudyLookup(cs),
            new CaseStudyFailureCommands(cs, tasks, timeline),
            notifications,
            recipients,
            labels);
    }

    public static PropertyAccessHoldService CreateAccessHolds(
        DbContext app,
        FailuresDbContext failures)
    {
        var cs = TestInspectorFeeServiceFactory.ShareCaseStudy(app);
        return new(new CaseStudyLookup(cs), CreateFailureService(app, failures));
    }

    public static KeyEnvelopesService CreateKeyEnvelopesService(Bundle bundle)
    {
        return CreateKeyEnvelopesService(bundle.CaseStudy, bundle.Failures, bundle.Ops);
    }

    public static KeyEnvelopesService CreateKeyEnvelopesService(
        DbContext app,
        FailuresDbContext failures,
        OperationsDbContext ops)
    {
        var cs = TestInspectorFeeServiceFactory.ShareCaseStudy(app);
        var identity = TestInspectorFeeServiceFactory.ShareIdentity(app);
        return new(
            ops,
            new CaseStudyLookup(cs),
            new KeyReceiptFeeChargeService(TestInspectorFeeServiceFactory.ShareFinancial(app)),
            TestInspectorFeeServiceFactory.ShareAttachmentLookup(app),
            CreateAccessHolds(app, failures),
            new KeyEnvelopePeopleResolver(new UserLabelLookup(identity)),
            new NullNotificationService(),
            TestNotificationRecipients.ForContexts(cs, identity));
    }

    public static PropertyKeyGateResolver CreateKeyGate(DbContext app, OperationsDbContext ops) =>
        new(ops, new CaseStudyLookup(TestInspectorFeeServiceFactory.ShareCaseStudy(app)));

    public static PropertyKeyGateResolver CreateKeyGate(Bundle bundle) =>
        CreateKeyGate(bundle.CaseStudy, bundle.Ops);

    public static PropertyKeysService CreatePropertyKeys(Bundle bundle) =>
        new(bundle.Ops, new CaseStudyLookup(bundle.CaseStudy));

    public static OperationsTaskService CreateOperationsTasks(
        Bundle bundle,
        INotificationService? notifications = null,
        IPartyFeePricingService? pricing = null) =>
        OperationsTaskService.Create(
            bundle.Ops,
            new CourtVisitFeeChargeService(TestInspectorFeeServiceFactory.ShareFinancial(bundle.CaseStudy)),
            new IdentityDirectory(TestInspectorFeeServiceFactory.ShareIdentity(bundle.CaseStudy)),
            new UserLabelLookup(TestInspectorFeeServiceFactory.ShareIdentity(bundle.CaseStudy)),
            notifications ?? new NullNotificationService(),
            pricing ?? new PartyFeePricingService(
                TestInspectorFeeServiceFactory.ShareFinancial(bundle.CaseStudy)));

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
