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
    public async Task ConfirmDistribution_government_review_queues_outbox_with_operations_tasks_href()
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

        Assert.Null(errors);
        Assert.NotNull(result);
        var child = Assert.Single(result!.Children);
        Assert.Equal(WorkflowTaskKindValues.GovernmentReview, child.Kind);

        var payload = await AssertSingleNotificationRequest(db);
        Assert.Equal(["user-gov"], payload.UserIds);
        Assert.Equal("معاملة جديدة بانتظارك", payload.Title);
        Assert.Equal(NotificationContract.Categories.Workflow, payload.Category);
        Assert.Equal(NotificationContract.EntityTypes.Task, payload.EntityType);
        Assert.Equal(child.Id, payload.EntityId);
        Assert.Equal("/operations-tasks", payload.Href);
        Assert.Equal($"distribution-assigned:{child.Id}", payload.SourceEvent);
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
