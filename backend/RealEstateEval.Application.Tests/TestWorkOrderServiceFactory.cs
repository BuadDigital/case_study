using RealEstateEval.Application.Abstractions;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Notifications;
using RealEstateEval.Infrastructure.Services;
using Microsoft.Extensions.Options;
using RealEstateEval.Failures.Application.Abstractions;
using RealEstateEval.Failures.Infrastructure.Data.Contexts;
using RealEstateEval.CaseStudy.Infrastructure.Services;
using RealEstateEval.Failures.Infrastructure.Services;
using RealEstateEval.Financial.Infrastructure.Services;
using RealEstateEval.Identity.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;
internal static class TestWorkOrderServiceFactory
{
    public static WorkOrderService Create(
        Microsoft.EntityFrameworkCore.DbContext db,
        INotificationService? notifications = null,
        NotificationRecipientResolver? recipients = null,
        IPropertyTimelineService? timeline = null,
        IFailureService? failures = null,
        IOrganizationSettingsService? organizationSettings = null,
        IOptions<DatabaseOptions>? dbOptions = null,
        FailuresDbContext? failuresDb = null)
    {
        timeline ??= TestInspectorFeeServiceFactory.CreateTimeline(db, failuresDb ?? TestInspectorFeeServiceFactory.ShareFailures(db));
        notifications ??= new NullNotificationService();
        recipients ??= TestInspectorFeeServiceFactory.CreateRecipients(db);
        if (failures is null)
        {
 // Prefer a shared-root Failures context from the test fixture.
            if (failuresDb is null)
                throw new InvalidOperationException(
                    "Pass FailuresDbContext (via TestBoundedContexts.Create) or an IFailureService.");
            failures = TestBoundedContexts.CreateFailureService(
                db,
                failuresDb,
                timeline: timeline,
                notifications: notifications,
                recipients: recipients);
        }

        var caseStudy = TestInspectorFeeServiceFactory.ShareCaseStudy(db);
        var failuresCtx = failuresDb ?? TestInspectorFeeServiceFactory.ShareFailures(db);
        var financial = TestInspectorFeeServiceFactory.ShareFinancial(db);
        var identity = TestInspectorFeeServiceFactory.ShareIdentity(db);
        var loader = new WorkOrderLoader(caseStudy);
        var visibility = new WorkOrderVisibilityFilter(caseStudy);
        var query = new WorkOrderQueryService(caseStudy, new FailureLookup(failuresCtx), new PoEnfazInvoiceLookup(financial), new UserLabelLookup(identity), loader, visibility, dbOptions);
        var properties = new WorkOrderPropertyCommands(caseStudy, new FailureLookup(failuresCtx), new UserLabelLookup(identity), loader, timeline, failures);
        return new WorkOrderService(
            caseStudy,
            timeline,
            notifications,
            recipients,
            loader,
            query,
            properties,
            organizationSettings);
    }

    public static WorkOrderService Create(
        TestBoundedContexts.Bundle bundle,
        INotificationService? notifications = null,
        NotificationRecipientResolver? recipients = null,
        IPropertyTimelineService? timeline = null,
        IFailureService? failures = null,
        IOrganizationSettingsService? organizationSettings = null,
        IOptions<DatabaseOptions>? dbOptions = null) =>
        Create(
            bundle.CaseStudy,
            notifications,
            recipients,
            timeline,
            failures,
            organizationSettings,
            dbOptions,
            failuresDb: bundle.Failures);

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
