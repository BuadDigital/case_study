using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Domain;
using RealEstateEval.Failures.Application.Contracts;
using RealEstateEval.Failures.Domain;
using RealEstateEval.Identity.Infrastructure.Data.Contexts;
using RealEstateEval.Shared.Contracts;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// «معاملة أُعيدت إليك»: the case specialist hears that an obstructed transaction is back in
/// their queue whether a supervisor moved it by hand or resolving the failure moved it.
/// Both paths share one patch mapping and one post-patch notifier.
/// </summary>
public sealed class SpecialistReturnedNotificationTests
{
    private static readonly Guid FailureId = Guid.Parse("a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1");
    private static readonly Guid PropertyId = Guid.Parse("b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2");
    private static readonly Guid TaskId = Guid.Parse("c3c3c3c3-c3c3-c3c3-c3c3-c3c3c3c3c3c3");
    private const string PoNumber = "PO-RETURN-1";
    private const string SpecialistAssigneeId = "cs-1";
    private const string SpecialistUserId = "user-specialist";

    [Fact]
    public async Task Resolving_the_failure_tells_the_specialist_exactly_once()
    {
        var bundle = await SeedAsync();
        var notifications = new RecordingNotifications();
        var service = TestBoundedContexts.CreateFailureService(bundle, notifications: notifications);

        var dto = await service.ResolveAsync(
            FailureId,
            new ResolveFailureRequest
            {
                ResolutionReason = "تمت المعالجة",
                ContinueInstructions = "أكمل دراسة الحالة",
            });

        Assert.NotNull(dto);
        var returned = Assert.Single(
            notifications.Sent,
            n => n.Request.SourceEvent?.StartsWith($"case-study-returned:{TaskId}", StringComparison.Ordinal) == true);
        Assert.Equal(SpecialistUserId, returned.UserId);
        Assert.Equal("معاملة أُعيدت إليك", returned.Request.Title);
        Assert.Equal($"/case-study/{TaskId}", returned.Request.Href);
    }

    [Fact]
    public async Task A_supervisor_returning_the_task_by_hand_still_tells_the_specialist_once()
    {
        var bundle = await SeedAsync(seedFailure: false);
        var db = bundle.CaseStudy;
        var notifications = new RecordingNotifications();
        var recipients = TestInspectorFeeServiceFactory.CreateRecipients(db);
        var workflow = TestInspectorFeeServiceFactory.ComposeWorkflow(
            db,
            TestInspectorFeeServiceFactory.Create(db),
            notifications,
            recipients,
            TestInspectorFeeServiceFactory.CreateTimeline(db));

        var dto = await workflow.PatchAsync(
            TaskId,
            new PatchWorkflowTaskRequest
            {
                Phase = WorkflowTaskPhase.CaseStudy.ToDbValue(),
                Status = WorkflowTaskStatusValues.Open,
                AssigneeRole = StaffRoleIds.CaseSpecialist,
                AssigneeName = "أخصائي دراسة الحالة",
                ObstructionReason = "",
                ObstructionPriorPhase = "",
            });

        Assert.NotNull(dto);
        var returned = Assert.Single(
            notifications.Sent,
            n => n.Request.SourceEvent?.StartsWith($"case-study-returned:{TaskId}", StringComparison.Ordinal) == true);
        Assert.Equal(SpecialistUserId, returned.UserId);
    }

    [Fact]
    public async Task Escalating_an_obstruction_does_not_send_the_returned_notice()
    {
        var bundle = await SeedAsync(blocked: false);
        var notifications = new RecordingNotifications();
        var patcher = TestInspectorFeeServiceFactory.CreateShellPatcher(bundle.CaseStudy, notifications);

        await patcher.PatchAsync(
            TaskId,
            new PatchWorkflowTaskRequest
            {
                Phase = WorkflowTaskPhaseValues.Obstruction,
                ObstructionPriorPhase = WorkflowTaskPhase.CaseStudy.ToDbValue(),
                AssigneeRole = StaffRoleIds.SectionSupervisor,
                AssigneeName = "مشرف دراسة الحالة",
                Status = WorkflowTaskStatusValues.Blocked,
                ObstructionReason = "تعذر",
            });

        Assert.Empty(notifications.Sent);
    }

    private static async Task<TestBoundedContexts.Bundle> SeedAsync(
        bool seedFailure = true,
        bool blocked = true)
    {
        var bundle = TestBoundedContexts.Create($"specialist-returned-{Guid.NewGuid():N}");
        var db = bundle.CaseStudy;
        var now = DateTime.UtcNow;

        // Without a profile the resolver finds nobody and every assertion would pass vacuously.
        var identity = TestInspectorFeeServiceFactory.ShareIdentity(db);
        identity.Users.Add(new ApplicationUser
        {
            Id = SpecialistUserId,
            UserName = SpecialistUserId,
            Email = $"{SpecialistUserId}@example.test",
            NormalizedEmail = $"{SpecialistUserId}@EXAMPLE.TEST",
            DisplayName = SpecialistUserId,
        });
        identity.UserProfiles.Add(new UserProfile
        {
            UserId = SpecialistUserId,
            DistributionAssigneeId = SpecialistAssigneeId,
            JobTitle = "specialist",
            RoleId = StaffRoleIds.CaseSpecialist,
            Status = UserStatus.Active,
            CreatedAtUtc = now,
        });
        await identity.SaveChangesAsync();

        var workOrderId = Guid.NewGuid();
        db.WorkOrders.Add(new WorkOrder
        {
            Id = workOrderId,
            PoNumber = PoNumber,
            AssignmentType = AssignmentType.Execution,
            PromulgationDate = DateOnly.FromDateTime(now),
            ReceivedFromEnfathAt = DateOnly.FromDateTime(now),
            DueDateAt = DateOnly.FromDateTime(now.AddDays(7)),
            CreatedAtUtc = now,
        });
        db.WorkOrderProperties.Add(new WorkOrderProperty
        {
            Id = PropertyId,
            WorkOrderId = workOrderId,
            IdentifierType = PropertyIdentifierType.Deed,
            DeedNumber = "DEED-R1",
            City = "الرياض",
            Classification = "سكني",
            PropertyType = "فيلا",
            BoundariesAvailability = "yes",
        });

        var task = WorkflowTask.Create(
            WorkflowTaskKind.CaseStudyProperty,
            PoNumber,
            now,
            phase: blocked ? WorkflowTaskPhase.Obstruction : WorkflowTaskPhase.CaseStudy,
            status: blocked ? WorkflowTaskStatus.Blocked : WorkflowTaskStatus.Open,
            id: TaskId,
            propertyId: PropertyId,
            assigneeId: SpecialistAssigneeId);
        task.ApplyShellPatch(
            phase: null,
            status: null,
            title: null,
            assigneeRole: blocked ? StaffRoleIds.SectionSupervisor : StaffRoleIds.CaseSpecialist,
            assigneeName: null,
            assigneeId: null,
            assigneeIdProvided: false,
            propertyId: null,
            propertyIdProvided: false,
            obstructionReason: blocked ? "تعذر" : null,
            obstructionReasonProvided: blocked,
            obstructionPriorPhase: blocked ? WorkflowTaskPhase.CaseStudy : null,
            obstructionPriorPhaseProvided: blocked,
            distributionJson: null,
            nowUtc: now);
        db.WorkflowTasks.Add(task);

        if (seedFailure)
        {
            bundle.Failures.PropertyFailures.Add(PropertyFailure.Reconstitute(
                FailureId,
                PoNumber,
                PropertyId,
                "DEED-R1",
                "عدم معرفة حدود العقار",
                "unknown-boundaries",
                "internal",
                "النظام",
                "تعذر الوصول.",
                "",
                PropertyFailureStatus.Internal,
                "specialist",
                now,
                now));
        }

        await db.SaveChangesAsync();
        await bundle.Failures.SaveChangesAsync();
        return bundle;
    }

    private sealed class RecordingNotifications : INotificationService
    {
        public List<(string UserId, CreateUserNotificationRequest Request)> Sent { get; } = [];

        public Task<UserNotificationDto> CreateForUserAsync(
            string userId,
            CreateUserNotificationRequest request,
            CancellationToken cancellationToken = default)
        {
            Sent.Add((userId, request));
            return Task.FromResult(new UserNotificationDto { Title = request.Title });
        }

        public Task<int> CreateForUsersAsync(
            IReadOnlyCollection<string> userIds,
            CreateUserNotificationRequest request,
            CancellationToken cancellationToken = default)
        {
            foreach (var userId in userIds) Sent.Add((userId, request));
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
}
