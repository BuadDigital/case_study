using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Integration;
using RealEstateEval.Infrastructure.Notifications;
using RealEstateEval.Infrastructure.Services;
using RealEstateEval.Shared.Contracts;

namespace RealEstateEval.Application.Tests;

public sealed class AssignmentNotificationRegressionTests
{
    [Fact]
    public async Task OperationsTask_CreateAsync_queues_assignee_notification()
    {
        var bundle = CreateDb();
        var db = bundle.App;
        SeedAssigneeProfile(db, "user-reviewer", "gov-1");
        await db.SaveChangesAsync();
        var service = CreateOpsService(bundle);

        var (task, error) = await service.CreateAsync(
            new CreateOperationsTaskRequest
            {
                Type = "general",
                Title = "مراجعة حكومية",
                Scope = "general",
                AssigneeId = "gov-1",
                AssigneeName = "مراجع",
                Priority = "medium",
            },
            "creator-1",
            "منشئ");

        Assert.Null(error);
        Assert.NotNull(task);
        var payload = await AssertSingleNotificationRequest(db);
        Assert.Equal(["user-reviewer"], payload.UserIds);
        Assert.Equal("مهمة جديدة بانتظارك", payload.Title);
        Assert.Equal(NotificationContract.Categories.Workflow, payload.Category);
        Assert.Equal(NotificationContract.EntityTypes.OperationsTask, payload.EntityType);
        Assert.Equal(task!.Id, payload.EntityId);
        Assert.Equal($"/operations-tasks?task={task.Id}", payload.Href);
        Assert.Equal($"ops-task-assigned:{task.Id}", payload.SourceEvent);
    }

    [Fact]
    public async Task OperationsTask_ReassignAsync_queues_new_assignee_notification()
    {
        var bundle = CreateDb();
        var db = bundle.App;
        SeedAssigneeProfile(db, "user-a", "a-1");
        SeedAssigneeProfile(db, "user-b", "b-1");
        await db.SaveChangesAsync();
        var service = CreateOpsService(bundle);

        var (created, _) = await service.CreateAsync(
            new CreateOperationsTaskRequest
            {
                Type = "general",
                Title = "إعادة توجيه",
                Scope = "general",
                AssigneeId = "a-1",
                AssigneeName = "أ",
            },
            "creator-1",
            "منشئ");
        Assert.NotNull(created);
        Assert.Single(await db.OutboxMessages.ToListAsync());

        var (reassigned, error) = await service.ReassignAsync(
            Guid.Parse(created!.Id),
            new ReassignOperationsTaskRequest
            {
                AssigneeId = "b-1",
                AssigneeName = "ب",
                Reason = "تغطية بديلة",
            },
            "creator-1",
            "منشئ",
            "case-specialist");

        Assert.Null(error);
        Assert.NotNull(reassigned);
        var rows = await db.OutboxMessages.OrderBy(r => r.CreatedAtUtc).ToListAsync();
        Assert.Equal(2, rows.Count);
        var payload = Deserialize(rows[^1]);
        Assert.Equal(["user-b"], payload.UserIds);
        Assert.Equal($"ops-task-assigned:{created.Id}", payload.SourceEvent);
        Assert.Equal($"/operations-tasks?task={created.Id}", payload.Href);
    }

    [Fact]
    public async Task OperationsTask_Receipt_and_Complete_notify_creator_and_section_supervisor()
    {
        var bundle = CreateDb();
        var db = bundle.App;
        SeedAssigneeProfile(db, "user-gov", "gov-1");
        SeedRoleProfile(db, "user-specialist", "case-specialist");
        SeedRoleProfile(db, "user-supervisor", "section-supervisor");
        await db.SaveChangesAsync();
        var service = CreateOpsService(bundle);

        var (created, createError) = await service.CreateAsync(
            new CreateOperationsTaskRequest
            {
                Type = "general",
                Title = "زيارة",
                Scope = "general",
                AssigneeId = "gov-1",
                AssigneeName = "فراس",
            },
            "user-specialist",
            "أخصائي");
        Assert.Null(createError);
        Assert.NotNull(created);

        var (started, startError) = await service.PatchAsync(
            Guid.Parse(created!.Id),
            new PatchOperationsTaskRequest { Status = "in_progress" },
            "gov-1",
            "فراس",
            "government-reviewer",
            "user-gov");
        Assert.Null(startError);
        Assert.NotNull(started);

        var receiptRows = await db.OutboxMessages.OrderBy(r => r.CreatedAtUtc).ToListAsync();
        var receipt = Deserialize(receiptRows[^1]);
        Assert.Equal("تأكيد استلام المهمة", receipt.Title);
        Assert.Equal($"ops-task-receipt:{created.Id}", receipt.SourceEvent);
        Assert.Contains("user-specialist", receipt.UserIds);
        Assert.Contains("user-supervisor", receipt.UserIds);
        Assert.DoesNotContain("user-gov", receipt.UserIds);

 // complete after receipt
        var (done, doneError) = await service.PatchAsync(
            Guid.Parse(created.Id),
            new PatchOperationsTaskRequest { Status = "completed" },
            "gov-1",
            "فراس",
            "government-reviewer",
            "user-gov");
        Assert.Null(doneError);
        Assert.NotNull(done);

        var complete = Deserialize(
            (await db.OutboxMessages.OrderBy(r => r.CreatedAtUtc).ToListAsync())[^1]);
        Assert.Equal("اكتملت المهمة", complete.Title);
        Assert.Equal($"ops-task-done:{created.Id}", complete.SourceEvent);
        Assert.Contains("user-specialist", complete.UserIds);
        Assert.Contains("user-supervisor", complete.UserIds);
        Assert.DoesNotContain("user-gov", complete.UserIds);
    }

    [Fact]
    public async Task OperationsTask_Cancel_priority_comment_notify_counterparties()
    {
        var bundle = CreateDb();
        var db = bundle.App;
        SeedAssigneeProfile(db, "user-gov", "gov-1");
        SeedRoleProfile(db, "user-specialist", "case-specialist");
        await db.SaveChangesAsync();
        var service = CreateOpsService(bundle);

        var (created, _) = await service.CreateAsync(
            new CreateOperationsTaskRequest
            {
                Type = "general",
                Title = "مهمة إشعار",
                Scope = "general",
                AssigneeId = "gov-1",
                AssigneeName = "فراس",
                Priority = "medium",
            },
            "user-specialist",
            "أخصائي");
        Assert.NotNull(created);
        var taskId = Guid.Parse(created!.Id);

 // priority change → assignee
        var (_, prioErr) = await service.PatchAsync(
            taskId,
            new PatchOperationsTaskRequest { Priority = "high" },
            "user-specialist",
            "أخصائي",
            "case-specialist",
            "user-specialist");
        Assert.Null(prioErr);
        var prioPayload = Deserialize(
            (await db.OutboxMessages.OrderBy(r => r.CreatedAtUtc).ToListAsync())[^1]);
        Assert.Equal("تحديث على المهمة", prioPayload.Title);
        Assert.Equal(["user-gov"], prioPayload.UserIds);
        Assert.StartsWith("ops-task-schedule:", prioPayload.SourceEvent);

 // comment from creator → assignee
        var (_, cmtErr) = await service.AddCommentAsync(
            taskId,
            new AddOperationsTaskCommentRequest { Text = "يرجى المتابعة" },
            "user-specialist",
            "case-specialist",
            "أخصائي");
        Assert.Null(cmtErr);
        var cmtPayload = Deserialize(
            (await db.OutboxMessages.OrderBy(r => r.CreatedAtUtc).ToListAsync())[^1]);
        Assert.Equal("تحديث على المهمة", cmtPayload.Title);
        Assert.Equal(["user-gov"], cmtPayload.UserIds);
        Assert.StartsWith("ops-task-comment:", cmtPayload.SourceEvent);

 // cancel → assignee
        var (_, cancelErr) = await service.PatchAsync(
            taskId,
            new PatchOperationsTaskRequest
            {
                Status = "cancelled",
                CancelReason = "لا حاجة",
            },
            "user-specialist",
            "أخصائي",
            "case-specialist",
            "user-specialist");
        Assert.Null(cancelErr);
        var cancelPayload = Deserialize(
            (await db.OutboxMessages.OrderBy(r => r.CreatedAtUtc).ToListAsync())[^1]);
        Assert.Equal("أُلغيت المهمة", cancelPayload.Title);
        Assert.Equal(["user-gov"], cancelPayload.UserIds);
        Assert.Equal($"ops-task-cancelled:{created.Id}", cancelPayload.SourceEvent);
    }

    [Fact]
    public async Task ConfirmDistribution_government_auditor_flag_is_ignored_and_does_not_spawn_child()
    {
        var bundle = CreateDb();
        var db = bundle.App;
        var propertyId = Guid.NewGuid();
        var workOrderId = Guid.NewGuid();
        var parentId = Guid.NewGuid();
        var now = DateTime.UtcNow;

        db.WorkOrders.Add(new WorkOrder
        {
            Id = workOrderId,
            PoNumber = "PO-GOV-DIST",
            AssignmentType = AssignmentType.Estates,
            PromulgationDate = DateOnly.FromDateTime(now),
            ReceivedFromEnfathAt = DateOnly.FromDateTime(now),
            DueDateAt = DateOnly.FromDateTime(now.AddDays(5)),
            ExpectedPropertyCount = 1,
            CreatedAtUtc = now,
        });
        db.WorkOrderProperties.Add(new WorkOrderProperty
        {
            Id = propertyId,
            WorkOrderId = workOrderId,
            DeedNumber = "DEED-900",
            RequestNumber = "REQ-900",
            City = "الرياض",
            District = "العليا",
            Circuit = "1",
            AssignmentMandateNumber = "M-900",
            AssignmentMandateDate = "2026-01-01",
        });
        db.WorkflowTasks.Add(WorkflowTask.Create(
            WorkflowTaskKind.CaseStudyProperty,
            "PO-GOV-DIST",
            now,
            title: "دراسة حالة",
            phase: WorkflowTaskPhase.Distribution,
            id: parentId,
            propertyId: propertyId));
        SeedAssigneeProfile(db, "user-gov", "gov-auditor-1");
        await db.SaveChangesAsync();

        var workflow = CreateWorkflowService(db);
        var (result, errors) = await workflow.ConfirmDistributionAsync(
            parentId,
            new ConfirmTaskDistributionRequest
            {
                DeedNumber = "DEED-900",
                Distribution = new TaskDistributionDraftDto
                {
                    GovernmentAuditor = true,
                    GovernmentAuditorId = "gov-auditor-1",
                },
                AssigneeNames = new Dictionary<string, string>
                {
                    [WorkflowTaskKindValues.GovernmentReview] = "مراجع حكومي",
                },
            });

        Assert.NotNull(errors);
        Assert.Null(result);
        Assert.Contains("طرفاً واحداً", errors!["_"]);
        Assert.Empty(await db.OutboxMessages.ToListAsync());
    }

    private static void SeedAssigneeProfile(
        ApplicationDbContext db,
        string userId,
        string distributionAssigneeId)
    {
        db.Users.Add(new ApplicationUser
        {
            Id = userId,
            UserName = userId,
            Email = $"{userId}@example.test",
            NormalizedEmail = $"{userId}@EXAMPLE.TEST",
            DisplayName = userId,
        });
        db.UserProfiles.Add(new UserProfile
        {
            UserId = userId,
            DistributionAssigneeId = distributionAssigneeId,
            JobTitle = "reviewer",
            RoleId = "government-reviewer",
            Status = UserStatus.Active,
            CreatedAtUtc = DateTime.UtcNow,
        });
    }

    private static void SeedRoleProfile(
        ApplicationDbContext db,
        string userId,
        string roleId)
    {
        db.Users.Add(new ApplicationUser
        {
            Id = userId,
            UserName = userId,
            Email = $"{userId}@example.test",
            NormalizedEmail = $"{userId}@EXAMPLE.TEST",
            DisplayName = userId,
        });
        db.UserProfiles.Add(new UserProfile
        {
            UserId = userId,
            JobTitle = roleId,
            RoleId = roleId,
            Status = UserStatus.Active,
            CreatedAtUtc = DateTime.UtcNow,
        });
    }

    private static async Task<NotificationUsersRequestedPayload> AssertSingleNotificationRequest(
        ApplicationDbContext db)
    {
        var outbox = Assert.Single(await db.OutboxMessages.ToListAsync());
        Assert.Equal(IntegrationEventTypes.NotificationUsersRequested, outbox.EventType);
        return Deserialize(outbox);
    }

    private static NotificationUsersRequestedPayload Deserialize(OutboxMessage outbox)
    {
        var envelope = JsonSerializer.Deserialize<
            IntegrationEventEnvelope<NotificationUsersRequestedPayload>>(outbox.PayloadJson);
        Assert.NotNull(envelope);
        return envelope.Payload;
    }

    private static OperationsTaskService CreateOpsService(TestBoundedContexts.Bundle bundle)
    {
        var db = bundle.App;
        var notifications = new PlatformNotificationRequestService(
            db,
            new OutboxIntegrationEventPublisher(
                db,
                NullLogger<OutboxIntegrationEventPublisher>.Instance));
        return OperationsTaskService.Create(
            bundle.Ops,
            db,
            notifications,
            new PartyFeePricingService(TestInspectorFeeServiceFactory.ShareFinancial(db)));
    }

    private static WorkflowTaskService CreateWorkflowService(ApplicationDbContext db)
    {
        var notifications = new PlatformNotificationRequestService(
            db,
            new OutboxIntegrationEventPublisher(
                db,
                NullLogger<OutboxIntegrationEventPublisher>.Instance));
        var recipients = TestInspectorFeeServiceFactory.CreateRecipients(db);
        var fees = TestInspectorFeeServiceFactory.Compose(
            db,
            notifications,
            recipients,
            new PartyFeePricingService(TestInspectorFeeServiceFactory.ShareFinancial(db)));
        return TestInspectorFeeServiceFactory.ComposeWorkflow(
            db,
            fees,
            notifications,
            recipients,
            TestInspectorFeeServiceFactory.CreateTimeline(db));
    }

    private static TestBoundedContexts.Bundle CreateDb() =>
        TestBoundedContexts.Create($"assign-notify-regression-{Guid.NewGuid():N}");
}
