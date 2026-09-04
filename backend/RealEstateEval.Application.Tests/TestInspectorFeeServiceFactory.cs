using RealEstateEval.Failures.Application.Abstractions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Storage;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Notifications;
using RealEstateEval.Infrastructure.Services;
using RealEstateEval.Financial.Application.Services;
using RealEstateEval.Financial.Infrastructure.Persistence;
using RealEstateEval.Financial.Infrastructure.Services;
using RealEstateEval.Financial.Infrastructure.Data.Contexts;
using RealEstateEval.CaseStudy.Infrastructure.Services;
using RealEstateEval.Identity.Infrastructure.Data.Contexts;
using RealEstateEval.Attachments.Infrastructure.Data.Contexts;
using RealEstateEval.Attachments.Application.Abstractions;
using RealEstateEval.Valuation.Infrastructure.Data.Contexts;
using RealEstateEval.Operations.Infrastructure.Data.Contexts;
using RealEstateEval.CaseStudy.Infrastructure.Data.Contexts;
using RealEstateEval.Failures.Infrastructure.Data.Contexts;
using RealEstateEval.Identity.Infrastructure.Services;
using RealEstateEval.Platform.Infrastructure.Data.Contexts;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.Attachments.Infrastructure.Services;
using RealEstateEval.Failures.Infrastructure.Services;
using RealEstateEval.CaseStudy.Infrastructure.Persistence;
using RealEstateEval.CaseStudy.Application.Services;

namespace RealEstateEval.Application.Tests;

internal static class TestInspectorFeeServiceFactory
{
 /// <summary>
 /// Shared in-memory App + Financial + Identity so pricing (Financial) and residual Identity
 /// profile reads stay in the same store as inspector-fee ledgers on App.
 /// </summary>
    internal sealed class Store : IAsyncDisposable
    {
        private readonly InMemoryDatabaseRoot _root = new();
        private readonly string _name;

        public Store(string prefix)
        {
            _name = $"{prefix}-{Guid.NewGuid():N}";
            Fin = Create<FinancialDbContext>(o => new FinancialDbContext(o));
            Identity = Create<IdentityDbContext>(o => new IdentityDbContext(o));
            CaseStudy = Create<CaseStudyDbContext>(o => new CaseStudyDbContext(o));
        }

        public FinancialDbContext Fin { get; }
        public IdentityDbContext Identity { get; }
        public CaseStudyDbContext CaseStudy { get; }

        public PartyFeePricingService Pricing() => TestPricing.Create(Fin);

        public IncentiveSuspensionService IncentiveSuspensions() => new(Fin, new IdentityDirectory(Identity));

        public DiscountFlagService DiscountFlags() => new(Fin, new CaseStudyLookup(CaseStudy));

        public InspectorFeeService Fees(
            INotificationService? notifications = null,
            NotificationRecipientResolver? recipients = null) =>
            Compose(
                CaseStudy,
                Fin,
                Identity,
                notifications ?? new NullNotificationService(),
                recipients ?? TestNotificationRecipients.ForContexts(CaseStudy, Identity),
                Pricing());

        public async ValueTask DisposeAsync()
        {
            await CaseStudy.DisposeAsync();
            await Identity.DisposeAsync();
            await Fin.DisposeAsync();
        }

        private TContext Create<TContext>(Func<DbContextOptions<TContext>, TContext> factory)
            where TContext : DbContext =>
            factory(new DbContextOptionsBuilder<TContext>()
                .UseInMemoryDatabase(_name, _root)
                .Options);
    }

    public static InspectorFeeService Create(DbContext db) =>
        Create(db, ShareFinancial(db));

    public static InspectorFeeService Create(DbContext db, FinancialDbContext fin)
    {
        var pricing = TestPricing.Create(fin);
        return Compose(db, new NullNotificationService(), CreateRecipients(db), pricing);
    }

    public static WorkflowTaskService CreateWorkflow(DbContext db) =>
        CreateWorkflow(db, ShareFinancial(db));

    public static WorkflowTaskService CreateWorkflow(DbContext db, FinancialDbContext fin)
    {
        var notifications = new NullNotificationService();
        var recipients = CreateRecipients(db);
        var fees = Compose(db, notifications, recipients, TestPricing.Create(fin));
        var timeline = CreateTimeline(db);
        return ComposeWorkflow(db, fees, notifications, recipients, timeline);
    }

 /// <summary>
 /// Companion Financial context sharing the same InMemory store name as <paramref name="db"/>
 /// so pricing / suspension rows seeded via App remain visible to
 /// <see cref="PartyFeePricingService"/>.
 /// </summary>
    public static FinancialDbContext ShareFinancial(DbContext db) =>
        CreateSibling<FinancialDbContext>(db, options => new FinancialDbContext(options));

    public static IdentityDbContext ShareIdentity(DbContext db) =>
        CreateSibling<IdentityDbContext>(db, options => new IdentityDbContext(options));

    public static AttachmentsDbContext ShareAttachments(DbContext db) =>
        CreateSibling<AttachmentsDbContext>(db, options => new AttachmentsDbContext(options));

    public static IAttachmentLookup ShareAttachmentLookup(DbContext db) =>
        new AttachmentLookup(ShareAttachments(db));

    public static ValuationDbContext ShareValuation(DbContext db) =>
        CreateSibling<ValuationDbContext>(db, options => new ValuationDbContext(options));

    public static OperationsDbContext ShareOps(DbContext db) =>
        CreateSibling<OperationsDbContext>(db, options => new OperationsDbContext(options));

    public static CaseStudyDbContext ShareCaseStudy(DbContext db) =>
        CreateSibling<CaseStudyDbContext>(db, options => new CaseStudyDbContext(options));

    public static FailuresDbContext ShareFailures(DbContext db) =>
        CreateSibling<FailuresDbContext>(db, options => new FailuresDbContext(options));

    public static NotificationRecipientResolver CreateRecipients(DbContext db) =>
        TestNotificationRecipients.ForContexts(ShareCaseStudy(db), ShareIdentity(db));

    public static PropertyTimelineService CreateTimeline(DbContext db) =>
        new(ShareCaseStudy(db), new FailureLookup(ShareFailures(db)));

    public static PropertyTimelineService CreateTimeline(DbContext db, FailuresDbContext failures) =>
        new(ShareCaseStudy(db), new FailureLookup(failures));

    public static WorkflowTaskShellPatcher CreateShellPatcher(DbContext db) =>
        new(ShareCaseStudy(db));

    public static UserLabelLookup CreateLabels(DbContext db) =>
        new(ShareIdentity(db));

    public static MessagingDbContext ShareMessaging(DbContext db) =>
        CreateSibling<MessagingDbContext>(db, options => new MessagingDbContext(options));

    public static PlatformDbContext SharePlatform(DbContext db) =>
        CreateSibling<PlatformDbContext>(db, options => new PlatformDbContext(options));

    private static TContext CreateSibling<TContext>(
        DbContext source,
        Func<DbContextOptions<TContext>, TContext> factory)
        where TContext : DbContext
    {
        var (storeName, root) = SharedInMemoryIdentity(source);
        var builder = new DbContextOptionsBuilder<TContext>();
        if (root is not null)
            builder.UseInMemoryDatabase(storeName, root);
        else
            builder.UseInMemoryDatabase(storeName);
        return factory(builder.Options);
    }

    private static (string StoreName, InMemoryDatabaseRoot? Root) SharedInMemoryIdentity(DbContext db)
    {
 // InMemory is non-relational — Database.GetDbConnection is unavailable. Reflect the
 // store name (and optional root) off the provider options extension.
        var options = db.GetService<IDbContextOptions>();
        string? storeName = null;
        InMemoryDatabaseRoot? root = null;
        const System.Reflection.BindingFlags flags =
            System.Reflection.BindingFlags.Instance
            | System.Reflection.BindingFlags.Public
            | System.Reflection.BindingFlags.NonPublic;

        foreach (var extension in options.Extensions)
        {
            var type = extension.GetType();
            if (type.FullName?.Contains("InMemory", StringComparison.Ordinal) != true)
                continue;

            foreach (var prop in type.GetProperties(flags))
            {
                if (prop.GetIndexParameters().Length > 0)
                    continue;
                if (prop.PropertyType == typeof(InMemoryDatabaseRoot))
                    root ??= prop.GetValue(extension) as InMemoryDatabaseRoot;
                else if (storeName is null
                    && prop.PropertyType == typeof(string)
                    && (prop.Name.Contains("Store", StringComparison.Ordinal)
                        || prop.Name.Contains("Database", StringComparison.Ordinal)
                        || prop.Name.Equals("Name", StringComparison.Ordinal)))
                {
                    var value = prop.GetValue(extension) as string;
                    if (!string.IsNullOrWhiteSpace(value))
                        storeName = value;
                }
            }

            foreach (var field in type.GetFields(flags))
            {
                if (field.FieldType == typeof(InMemoryDatabaseRoot))
                    root ??= field.GetValue(extension) as InMemoryDatabaseRoot;
            }
        }

        if (string.IsNullOrWhiteSpace(storeName))
        {
            throw new InvalidOperationException(
                "Cannot mirror contexts: source is not an EF Core InMemory store with a visible name.");
        }

        return (storeName, root);
    }

    public static WorkflowTaskService ComposeWorkflow(
        DbContext db,
        IInspectorFeeService fees,
        INotificationService notifications,
        NotificationRecipientResolver recipients,
        IPropertyTimelineService timeline)
    {
        var caseStudy = ShareCaseStudy(db);
        var failures = ShareFailures(db);
        var query = new WorkflowTaskQueryService(caseStudy);
        var slots = new WorkflowTaskSlotSynchronizer(new WorkflowTaskSlotRepository(caseStudy), query);
        var distribution = new WorkflowTaskDistributionCommands(
            new WorkflowTaskDistributionRepository(caseStudy),
            new BlockingOnlyFailureGate(new FailureLookup(failures)),
            notifications,
            recipients,
            timeline,
            NoOpValuationDispatch.Instance);
        var cascade = new WorkflowTaskCascadeCleanup(caseStudy, fees);
        var lifecycle = new WorkflowTaskLifecycleCommands(
            new WorkflowTaskLifecycleRepository(caseStudy), fees, timeline, cascade, slots, notifications, recipients);
        return new WorkflowTaskService(query, slots, distribution, lifecycle);
    }

    public static (INotificationService Notifications, NotificationRecipientResolver Recipients)
        CreateNotificationDeps(DbContext db)
    {
        return (new NullNotificationService(), CreateRecipients(db));
    }

    public static InspectorFeeService Compose(
        DbContext db,
        INotificationService notifications,
        NotificationRecipientResolver recipients,
        IPartyFeePricingService pricing)
    {
        var caseStudy = ShareCaseStudy(db);
        var financial = ShareFinancial(db);
        var identity = ShareIdentity(db);
        return Compose(caseStudy, financial, identity, notifications, recipients, pricing);
    }

    public static InspectorFeeService Compose(
        CaseStudyDbContext caseStudy,
        FinancialDbContext financial,
        IdentityDbContext identity,
        INotificationService notifications,
        NotificationRecipientResolver recipients,
        IPartyFeePricingService pricing)
    {
        var lookup = new CaseStudyLookup(caseStudy);
        var resolver = new InspectorFeeLedgerResolver(lookup, new IdentityDirectory(identity));
        var writer = new InspectorFeeLedgerWriter(financial, lookup, pricing, resolver);
        var summary = new InspectorFeeSummaryQuery(financial, lookup, new IdentityDirectory(identity));
        var transitions = new InspectorFeeTransitionApplier(financial, lookup, new AuditLogWriter());
        return new InspectorFeeService(
            lookup,
            new CaseStudyCommands(caseStudy),
            new InspectorFeeLedgerStore(financial),
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
            Task.FromResult(new PagedResultDto<UserNotificationDto> { Items = [], TotalCount = 0, Page = page, PageSize = take });

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

    /// <summary>
    /// Distribution only asks the gate whether an active failure blocks the property; the
    /// system-failure writes belong to the work-order property commands, which build their own
    /// gate over the real <c>IFailureService</c>.
    /// </summary>
    private sealed class BlockingOnlyFailureGate(IFailureLookup lookup) : ICaseStudyFailureGate
    {
        public Task<bool> HasBlockingFailureAsync(
            string poNumber,
            string propertyId,
            CancellationToken cancellationToken) =>
            lookup.HasBlockingAsync(poNumber, propertyId, cancellationToken);

        public Task EnsureSystemFailureAsync(
            string poNumber,
            string propertyId,
            string? deedNumber,
            string problemKey,
            string problemLabel,
            string detail,
            string raisedByLabel,
            CancellationToken cancellationToken) =>
            throw new NotSupportedException("Workflow distribution does not raise failures.");

        public Task ResolveSystemFailuresAsync(
            string poNumber,
            string propertyId,
            string problemKey,
            string raiserRole,
            string resolutionReason,
            string continueInstructions,
            CancellationToken cancellationToken) =>
            throw new NotSupportedException("Workflow distribution does not resolve failures.");
    }

    private sealed class NoOpValuationDispatch : ICaseStudyValuationDispatchService
    {
        public static readonly NoOpValuationDispatch Instance = new();

        public Task TryCreateWhenAppraisalSpawnedAsync(
            Guid parentTaskId,
            CancellationToken cancellationToken = default) =>
            Task.CompletedTask;
    }
}
