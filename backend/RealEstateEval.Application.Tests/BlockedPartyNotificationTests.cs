using Microsoft.AspNetCore.Http;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.CaseStudy.Application.Services;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.CaseStudy.Infrastructure.Data.Contexts;
using RealEstateEval.CaseStudy.Infrastructure.Persistence;
using RealEstateEval.CaseStudy.Infrastructure.Services;
using RealEstateEval.Domain;
using RealEstateEval.Failures.Infrastructure.Data.Contexts;
using RealEstateEval.Failures.Infrastructure.Services;
using RealEstateEval.Financial.Domain;
using RealEstateEval.Identity.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Services;
using RealEstateEval.Shared.Contracts;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// The Tier-1 notices: the moments a party is either blocked, or holding work that is no
/// longer theirs, and the system used to leave them to find out by reopening a screen.
/// </summary>
public sealed class BlockedPartyNotificationTests
{
    private static readonly Guid InspectionTaskId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid AppraisalTaskId = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid SurveyTaskId = Guid.Parse("33333333-3333-3333-3333-333333333333");
    private static readonly Guid ParentTaskId = Guid.Parse("44444444-4444-4444-4444-444444444444");
    private static readonly Guid PropertyId = Guid.Parse("55555555-5555-5555-5555-555555555555");

    [Fact]
    public void The_replaced_assignee_is_told_the_work_left_their_queue()
    {
        var child = WorkflowTask.Create(
            WorkflowTaskKind.FieldInspection,
            "PO-77",
            DateTime.UtcNow,
            title: "المعاينة الميدانية",
            id: InspectionTaskId,
            propertyId: PropertyId);

        var request = WorkflowTaskDistributionRules.AssignmentReplacedRequest(
            child,
            "صك 900",
            "المعاين معتذر");

        Assert.Equal("أُلغي إسنادك", request.Title);
        Assert.Contains("صك 900", request.Body);
        Assert.Contains("المعاين معتذر", request.Body);
        Assert.Equal(NotificationContract.Tones.Warn, request.Tone);
        Assert.Equal(NotificationContract.EntityTypes.Task, request.EntityType);
        Assert.Equal(child.Id.ToString(), request.EntityId);
        Assert.StartsWith($"distribution-replaced:{child.Id}", request.SourceEvent);
    }

    [Fact]
    public void A_replacement_without_a_reason_still_reads_as_a_sentence()
    {
        var child = WorkflowTask.Create(
            WorkflowTaskKind.EngineeringSurvey,
            "PO-77",
            DateTime.UtcNow,
            id: SurveyTaskId,
            propertyId: PropertyId);

        var request = WorkflowTaskDistributionRules.AssignmentReplacedRequest(child, "صك 900", null);

        Assert.EndsWith("لم تعد المهمة ضمن أعمالك.", request.Body);
    }

    [Fact]
    public async Task Accepting_the_inspection_unblocks_the_appraiser_and_the_survey_office()
    {
        var bundle = TestBoundedContexts.Create($"unblock-{Guid.NewGuid():N}");
        var db = bundle.CaseStudy;
        SeedAcceptableInspectionWithSiblings(db);
        var notifications = new RecordingNotifications();
        var service = CreateService(db, bundle.Failures, notifications);

        var (result, errors) = await service.AcceptAsync(
            InspectionTaskId,
            new PartySubmissionActor
            {
                UserId = "specialist-1",
                DisplayName = "أخصائي",
                PrototypeRole = "case-specialist",
            });

        Assert.Null(errors);
        Assert.NotNull(result);

        Assert.Contains(
            notifications.Sent,
            n => n.SourceEvent == $"field-inspection-accepted-appraiser:{InspectionTaskId}"
                && n.Title == "اعتُمدت المعاينة — يمكن بدء التقييم"
                && n.Href!.Contains(AppraisalTaskId.ToString()));
        Assert.Contains(
            notifications.Sent,
            n => n.SourceEvent == $"field-inspection-accepted-survey:{InspectionTaskId}"
                && n.Href!.Contains(SurveyTaskId.ToString()));
        // The inspector keeps their own acceptance notice — the siblings are additions.
        Assert.Contains(
            notifications.Sent,
            n => n.SourceEvent == $"field-inspection-accepted:{InspectionTaskId}");
    }

    [Fact]
    public async Task A_completed_survey_sibling_is_not_nudged_again()
    {
        var bundle = TestBoundedContexts.Create($"unblock-done-{Guid.NewGuid():N}");
        var db = bundle.CaseStudy;
        SeedAcceptableInspectionWithSiblings(db, surveyCompleted: true);
        var notifications = new RecordingNotifications();
        var service = CreateService(db, bundle.Failures, notifications);

        await service.AcceptAsync(
            InspectionTaskId,
            new PartySubmissionActor
            {
                UserId = "specialist-1",
                DisplayName = "أخصائي",
                PrototypeRole = "case-specialist",
            });

        Assert.DoesNotContain(
            notifications.Sent,
            n => n.SourceEvent == $"field-inspection-accepted-survey:{InspectionTaskId}");
        Assert.Contains(
            notifications.Sent,
            n => n.SourceEvent == $"field-inspection-accepted-appraiser:{InspectionTaskId}");
    }

    private static void SeedAcceptableInspectionWithSiblings(
        CaseStudyDbContext db,
        bool surveyCompleted = false)
    {
        var now = DateTime.UtcNow;
        // Party ids only reach an inbox through an identity profile — without these the
        // resolver returns nothing and every assertion below would pass vacuously.
        var identity = TestInspectorFeeServiceFactory.ShareIdentity(db);
        foreach (var (userId, assigneeId) in new[]
                 {
                     ("user-inspector", "fi-1"),
                     ("user-appraiser", "val-1"),
                     ("user-office", "eo-1"),
                 })
        {
            identity.Users.Add(new ApplicationUser
            {
                Id = userId,
                UserName = userId,
                Email = $"{userId}@example.test",
                NormalizedEmail = $"{userId}@EXAMPLE.TEST",
                DisplayName = userId,
            });
            identity.UserProfiles.Add(new UserProfile
            {
                UserId = userId,
                DistributionAssigneeId = assigneeId,
                JobTitle = "party",
                RoleId = "field-inspector",
                Status = UserStatus.Active,
                CreatedAtUtc = now,
            });
        }
        identity.SaveChanges();

        db.WorkflowTasks.Add(WorkflowTask.Create(
            WorkflowTaskKind.CaseStudyProperty,
            "PO-500",
            now,
            title: "دراسة الحالة",
            id: ParentTaskId,
            propertyId: PropertyId));
        db.WorkflowTasks.Add(WorkflowTask.Create(
            WorkflowTaskKind.FieldInspection,
            "PO-500",
            now,
            title: "المعاينة الميدانية",
            phase: WorkflowTaskPhase.Done,
            status: WorkflowTaskStatus.Completed,
            id: InspectionTaskId,
            propertyId: PropertyId,
            assigneeId: "fi-1",
            parentTaskId: ParentTaskId));
        db.WorkflowTasks.Add(WorkflowTask.Create(
            WorkflowTaskKind.PropertyAppraisal,
            "PO-500",
            now,
            title: "التقييم",
            id: AppraisalTaskId,
            propertyId: PropertyId,
            assigneeId: "val-1",
            parentTaskId: ParentTaskId));
        db.WorkflowTasks.Add(WorkflowTask.Create(
            WorkflowTaskKind.EngineeringSurvey,
            "PO-500",
            now,
            title: "الرفع المساحي",
            phase: surveyCompleted ? WorkflowTaskPhase.Done : WorkflowTaskPhase.Enfath,
            status: surveyCompleted ? WorkflowTaskStatus.Completed : WorkflowTaskStatus.Open,
            id: SurveyTaskId,
            propertyId: PropertyId,
            assigneeId: "eo-1",
            parentTaskId: ParentTaskId));
        db.PartyTaskSubmissions.Add(new PartyTaskSubmission
        {
            Id = Guid.NewGuid(),
            WorkflowTaskId = InspectionTaskId,
            Kind = "field-inspection",
            Status = PartyTaskSubmissionStatus.Submitted,
            PropertyId = PropertyId,
            PoNumber = "PO-500",
            PayloadJson = "{}",
            SubmittedAtUtc = now,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        });

        // Ledger already accrued so acceptance skips pricing entirely.
        var fin = TestInspectorFeeServiceFactory.ShareFinancial(db);
        fin.InspectorFeeLedgers.Add(new InspectorFeeLedger
        {
            WorkflowTaskId = InspectionTaskId,
            PoNumber = "PO-500",
            PropertyId = PropertyId,
            PropertyOrdinal = 1,
            InspectorType = "متعاون فرد",
            AgreedFeeSar = 1500m,
            BillingStatus = InspectorFeeBillingStatus.AtFinance,
            AccruedAtUtc = now,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        });
        db.SaveChanges();
        fin.SaveChanges();
    }

    private static PartyTaskSubmissionService CreateService(
        CaseStudyDbContext db,
        FailuresDbContext failures,
        INotificationService notifications)
    {
        var recipients = TestInspectorFeeServiceFactory.CreateRecipients(db);
        return new(
            new PartyTaskSubmissionRepository(db),
            new PartyTaskFailureGate(new FailureLookup(failures)),
            TestInspectorFeeServiceFactory.CreateWorkflow(db),
            new FieldInspectionAttachmentVerifier(
                TestInspectorFeeServiceFactory.ShareAttachmentLookup(db)),
            TestInspectorFeeServiceFactory.CreateTimeline(db),
            new HttpCurrentPrototypeRoleResolver(new NullHttpContextAccessor(), new NullPermissions()),
            TestInspectorFeeServiceFactory.Create(db),
            notifications,
            recipients,
            new AuditLogWriter(),
            new RecordingAuditLogAppend());
    }

    /// <summary>Records what was sent; recipient resolution has its own tests.</summary>
    private sealed class RecordingNotifications : INotificationService
    {
        public List<CreateUserNotificationRequest> Sent { get; } = [];

        public Task<UserNotificationDto> CreateForUserAsync(
            string userId,
            CreateUserNotificationRequest request,
            CancellationToken cancellationToken = default)
        {
            Sent.Add(request);
            return Task.FromResult(new UserNotificationDto { Title = request.Title });
        }

        public Task<int> CreateForUsersAsync(
            IReadOnlyCollection<string> userIds,
            CreateUserNotificationRequest request,
            CancellationToken cancellationToken = default)
        {
            Sent.Add(request);
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

    private sealed class NullHttpContextAccessor : IHttpContextAccessor
    {
        public HttpContext? HttpContext { get; set; }
    }

    private sealed class NullPermissions : IPermissionService
    {
        public Task<PermissionsDto?> GetForUserIdAsync(
            string userId,
            CancellationToken cancellationToken = default) =>
            Task.FromResult<PermissionsDto?>(null);
    }
}
