using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

public class PartyTaskSubmissionAuthorizationTests
{
    private static readonly Guid TaskId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static readonly Guid PropertyId = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");

    [Fact]
    public async Task SaveDraft_forbids_unassigned_party()
    {
        await using var db = CreateDb();
        SeedTask(db, assigneeId: "dist-owner");
        var service = CreateService(db);

        var payload = JsonDocument.Parse("""{"status":"draft","visitStatus":""}""").RootElement;
        var (result, errors) = await service.SaveDraftAsync(
            TaskId,
            new SavePartyTaskSubmissionRequest { Payload = payload },
            new PartySubmissionActor
            {
                UserId = "user-other",
                DisplayName = "آخر",
                PrototypeRole = "field-inspector",
                DistributionAssigneeId = "dist-other",
            });

        Assert.Null(result);
        Assert.NotNull(errors);
        Assert.Contains("صلاحية", errors!["_"]);
    }

    [Fact]
    public async Task SaveDraft_allows_matching_assignee()
    {
        await using var db = CreateDb();
        SeedTask(db, assigneeId: "dist-owner");
        var service = CreateService(db);

        var payload = JsonDocument.Parse("""{"status":"draft","visitStatus":""}""").RootElement;
        var (result, errors) = await service.SaveDraftAsync(
            TaskId,
            new SavePartyTaskSubmissionRequest { Payload = payload },
            new PartySubmissionActor
            {
                UserId = "user-owner",
                DisplayName = "المكلف",
                PrototypeRole = "government-reviewer",
                DistributionAssigneeId = "dist-owner",
            });

        Assert.Null(errors);
        Assert.NotNull(result);
        Assert.Equal("draft", result!.Status);
    }

    [Fact]
    public async Task Accept_forbids_party_role()
    {
        await using var db = CreateDb();
        SeedAcceptedableSurvey(db);
        var service = CreateService(db);

        var (result, errors) = await service.AcceptAsync(
            TaskId,
            new PartySubmissionActor
            {
                UserId = "eng-1",
                DisplayName = "مكتب",
                PrototypeRole = "engineering-office",
            });

        Assert.Null(result);
        Assert.NotNull(errors);
        Assert.Contains("صلاحية", errors!["_"]);
    }

    private static void SeedTask(ApplicationDbContext db, string assigneeId)
    {
        var now = DateTime.UtcNow;
        db.WorkflowTasks.Add(WorkflowTask.Create(
            WorkflowTaskKind.GovernmentReview,
            "PO-AUTH",
            now,
            title: "مراجعة",
            phase: WorkflowTaskPhase.Done,
            assigneeRole: "government-reviewer",
            assigneeName: "مراجع",
            id: TaskId,
            propertyId: PropertyId,
            assigneeId: assigneeId));
        db.SaveChanges();
    }

    private static void SeedAcceptedableSurvey(ApplicationDbContext db)
    {
        var now = DateTime.UtcNow;
        db.WorkflowTasks.Add(WorkflowTask.Create(
            WorkflowTaskKind.EngineeringSurvey,
            "PO-AUTH",
            now,
            title: "الرفع المساحي",
            phase: WorkflowTaskPhase.Done,
            status: WorkflowTaskStatus.Completed,
            id: TaskId,
            propertyId: PropertyId));
        db.PartyTaskSubmissions.Add(new PartyTaskSubmission
        {
            Id = Guid.NewGuid(),
            WorkflowTaskId = TaskId,
            Kind = "engineering-survey",
            Status = PartyTaskSubmissionStatus.Submitted,
            PropertyId = PropertyId,
            PoNumber = "PO-AUTH",
            PayloadJson = "{}",
            SubmittedAtUtc = now,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        });
        db.InspectorFeeLedgers.Add(new InspectorFeeLedger
        {
            WorkflowTaskId = TaskId,
            PoNumber = "PO-AUTH",
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
    }

    private static ApplicationDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase($"party-auth-{Guid.NewGuid():N}")
            .Options;
        return new ApplicationDbContext(options);
    }

    private static PartyTaskSubmissionService CreateService(ApplicationDbContext db)
    {
        var timeline = new PropertyTimelineService(db);
        var holds = new PropertyAccessHoldService(db);
        var (notifications, recipients) = TestInspectorFeeServiceFactory.CreateNotificationDeps(db);
        return new(
            db,
            TestInspectorFeeServiceFactory.CreateWorkflow(db),
            new FieldInspectionAttachmentVerifier(db),
            timeline,
            new NullHttpContextAccessor(),
            new NullPermissionService(),
            new PropertyKeyGateResolver(db),
            new KeyEnvelopesService(db, holds, new KeyEnvelopePeopleResolver(db)),
            TestInspectorFeeServiceFactory.Create(db),
            notifications,
            recipients);
    }

    private sealed class NullHttpContextAccessor : IHttpContextAccessor
    {
        public HttpContext? HttpContext { get; set; }
    }

    private sealed class NullPermissionService : IPermissionService
    {
        public Task<PermissionsDto?> GetForUserIdAsync(string userId, CancellationToken cancellationToken = default)
            => Task.FromResult<PermissionsDto?>(null);
    }
}
