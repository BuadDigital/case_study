using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Services;
using RealEstateEval.CaseStudy.Infrastructure.Data.Contexts;
using RealEstateEval.CaseStudy.Application.Services;
using RealEstateEval.CaseStudy.Infrastructure.Persistence;
using RealEstateEval.CaseStudy.Infrastructure.Services;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Financial.Domain;
using RealEstateEval.Failures.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

public class PartyTaskSubmissionAuthorizationTests
{
    private static readonly Guid TaskId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static readonly Guid PropertyId = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");

    [Fact]
    public async Task SaveDraft_forbids_unassigned_party()
    {
        var bundle = CreateDb();
        var db = bundle.CaseStudy;
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
        var bundle = CreateDb();
        var db = bundle.CaseStudy;
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
                PrototypeRole = "field-inspector",
                DistributionAssigneeId = "dist-owner",
            });

        Assert.Null(errors);
        Assert.NotNull(result);
        Assert.Equal("draft", result!.Status);
    }

    [Fact]
    public async Task SaveDraft_allows_case_specialist_to_correct_submitted_field_inspection()
    {
        var bundle = CreateDb();
        var db = bundle.CaseStudy;
        SeedTask(db, assigneeId: "dist-inspector");
        var now = DateTime.UtcNow;
        db.PartyTaskSubmissions.Add(new PartyTaskSubmission
        {
            Id = Guid.NewGuid(),
            WorkflowTaskId = TaskId,
            Kind = WorkflowTaskKindValues.FieldInspection,
            Status = PartyTaskSubmissionStatus.Submitted,
            PropertyId = PropertyId,
            PoNumber = "PO-AUTH",
            PayloadJson =
                """{"status":"submitted","mapLatitude":"21.58000","mapLongitude":"39.15000","inspectorMapLatitude":"21.58000","inspectorMapLongitude":"39.15000"}""",
            SubmittedAtUtc = now,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        });
        db.SaveChanges();
        var service = CreateService(db);

        var payload = JsonDocument.Parse(
            """{"status":"submitted","mapLatitude":"21.57805","mapLongitude":"39.15431","inspectorMapLatitude":"21.58000","inspectorMapLongitude":"39.15000"}""")
            .RootElement;
        var (result, errors) = await service.SaveDraftAsync(
            TaskId,
            new SavePartyTaskSubmissionRequest { Payload = payload },
            new PartySubmissionActor
            {
                UserId = "staff-1",
                DisplayName = "أخصائي",
                PrototypeRole = "case-specialist",
                DistributionAssigneeId = null,
            });

        Assert.Null(errors);
        Assert.NotNull(result);
        Assert.Equal(PartyTaskSubmissionStatus.Submitted, result!.Status);
        Assert.Contains("21.57805", result.Payload.GetRawText());
        Assert.Contains("inspectorMapLatitude", result.Payload.GetRawText());
        Assert.Contains("21.58000", result.Payload.GetRawText());
    }

    [Fact]
    public async Task SaveDraft_forbids_case_specialist_correcting_submitted_non_inspection()
    {
        var bundle = CreateDb();
        var db = bundle.CaseStudy;
        var now = DateTime.UtcNow;
        db.WorkflowTasks.Add(WorkflowTask.Create(
            WorkflowTaskKind.EngineeringSurvey,
            "PO-AUTH",
            now,
            title: "الرفع المساحي",
            phase: WorkflowTaskPhase.Done,
            assigneeRole: "engineering-office",
            assigneeName: "مكتب",
            id: TaskId,
            propertyId: PropertyId,
            assigneeId: "eng-1"));
        db.PartyTaskSubmissions.Add(new PartyTaskSubmission
        {
            Id = Guid.NewGuid(),
            WorkflowTaskId = TaskId,
            Kind = WorkflowTaskKindValues.EngineeringSurvey,
            Status = PartyTaskSubmissionStatus.Submitted,
            PropertyId = PropertyId,
            PoNumber = "PO-AUTH",
            PayloadJson = """{"status":"submitted"}""",
            SubmittedAtUtc = now,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        });
        db.SaveChanges();
        var service = CreateService(db);

        var payload = JsonDocument.Parse("""{"status":"submitted","note":"x"}""").RootElement;
        var (result, errors) = await service.SaveDraftAsync(
            TaskId,
            new SavePartyTaskSubmissionRequest { Payload = payload },
            new PartySubmissionActor
            {
                UserId = "staff-1",
                DisplayName = "أخصائي",
                PrototypeRole = "case-specialist",
            });

        Assert.Null(result);
        Assert.NotNull(errors);
        Assert.Contains("صلاحية", errors!["_"]);
    }

    [Fact]
    public async Task Accept_forbids_party_role()
    {
        var bundle = CreateDb();
        var db = bundle.CaseStudy;
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

    [Fact]
    public async Task Get_allows_property_appraisal_assignee_to_read_completed_sibling_inspection()
    {
        var bundle = CreateDb();
        var db = bundle.CaseStudy;
        var parentId = Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc");
        var now = DateTime.UtcNow;
        var inspection = WorkflowTask.Create(
            WorkflowTaskKind.FieldInspection,
            "PO-SIBLING",
            now,
            title: "معاينة",
            phase: WorkflowTaskPhase.Done,
            assigneeRole: "field-inspector",
            assigneeName: "معاين",
            assigneeId: "fi-1",
            id: TaskId,
            parentTaskId: parentId,
            propertyId: PropertyId);
        inspection.Complete(now);
        db.WorkflowTasks.AddRange(
            WorkflowTask.Create(
                WorkflowTaskKind.CaseStudyProperty,
                "PO-SIBLING",
                now,
                title: "parent",
                phase: WorkflowTaskPhase.Done,
                assigneeRole: "case-specialist",
                assigneeName: "cs",
                assigneeId: "cs-1",
                id: parentId,
                propertyId: PropertyId),
            inspection,
            WorkflowTask.Create(
                WorkflowTaskKind.PropertyAppraisal,
                "PO-SIBLING",
                now,
                title: "تقييم",
                phase: WorkflowTaskPhase.Done,
                assigneeRole: "real-estate-appraiser",
                assigneeName: "مقيم",
                assigneeId: "val-1",
                parentTaskId: parentId,
                propertyId: PropertyId));
        db.PartyTaskSubmissions.Add(new PartyTaskSubmission
        {
            Id = Guid.NewGuid(),
            WorkflowTaskId = TaskId,
            Kind = "field-inspection",
            Status = PartyTaskSubmissionStatus.Submitted,
            PropertyId = PropertyId,
            PoNumber = "PO-SIBLING",
            PayloadJson = """{"visitStatus":"done"}""",
            SubmittedAtUtc = now,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        });
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var dto = await service.GetAsync(
            TaskId,
            new PartySubmissionActor
            {
                UserId = "val-user",
                DisplayName = "مقيم",
                PrototypeRole = "real-estate-appraiser",
                DistributionAssigneeId = "val-1",
            });

        Assert.NotNull(dto);
        Assert.Equal(TaskId.ToString(), dto!.TaskId);
    }

    [Fact]
    public async Task Get_forbids_unrelated_appraiser_from_sibling_inspection()
    {
        var bundle = CreateDb();
        var db = bundle.CaseStudy;
        var parentId = Guid.Parse("dddddddd-dddd-dddd-dddd-dddddddddddd");
        var now = DateTime.UtcNow;
        var inspection = WorkflowTask.Create(
            WorkflowTaskKind.FieldInspection,
            "PO-SIBLING-DENY",
            now,
            title: "معاينة",
            phase: WorkflowTaskPhase.Done,
            assigneeRole: "field-inspector",
            assigneeName: "معاين",
            assigneeId: "fi-1",
            id: TaskId,
            parentTaskId: parentId,
            propertyId: PropertyId);
        inspection.Complete(now);
        db.WorkflowTasks.AddRange(
            WorkflowTask.Create(
                WorkflowTaskKind.CaseStudyProperty,
                "PO-SIBLING-DENY",
                now,
                title: "parent",
                phase: WorkflowTaskPhase.Done,
                assigneeRole: "case-specialist",
                assigneeName: "cs",
                assigneeId: "cs-1",
                id: parentId,
                propertyId: PropertyId),
            inspection,
            WorkflowTask.Create(
                WorkflowTaskKind.PropertyAppraisal,
                "PO-SIBLING-DENY",
                now,
                title: "تقييم",
                phase: WorkflowTaskPhase.Done,
                assigneeRole: "real-estate-appraiser",
                assigneeName: "مقيم",
                assigneeId: "val-1",
                parentTaskId: parentId,
                propertyId: PropertyId));
        db.PartyTaskSubmissions.Add(new PartyTaskSubmission
        {
            Id = Guid.NewGuid(),
            WorkflowTaskId = TaskId,
            Kind = "field-inspection",
            Status = PartyTaskSubmissionStatus.Submitted,
            PropertyId = PropertyId,
            PoNumber = "PO-SIBLING-DENY",
            PayloadJson = "{}",
            SubmittedAtUtc = now,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        });
        await db.SaveChangesAsync();

        var service = CreateService(db);
        var dto = await service.GetAsync(
            TaskId,
            new PartySubmissionActor
            {
                UserId = "other-val",
                DisplayName = "مقيم آخر",
                PrototypeRole = "real-estate-appraiser",
                DistributionAssigneeId = "val-other",
            });

        Assert.Null(dto);
    }

    private static void SeedTask(CaseStudyDbContext db, string assigneeId)
    {
        var now = DateTime.UtcNow;
        db.WorkflowTasks.Add(WorkflowTask.Create(
            WorkflowTaskKind.FieldInspection,
            "PO-AUTH",
            now,
            title: "معاينة",
            phase: WorkflowTaskPhase.Done,
            assigneeRole: "field-inspector",
            assigneeName: "معاين",
            id: TaskId,
            propertyId: PropertyId,
            assigneeId: assigneeId));
        db.SaveChanges();
    }

    private static void SeedAcceptedableSurvey(CaseStudyDbContext db)
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
        var fin = TestInspectorFeeServiceFactory.ShareFinancial(db);
        fin.InspectorFeeLedgers.Add(new InspectorFeeLedger
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
        fin.SaveChanges();
    }

    private static TestBoundedContexts.Bundle CreateDb() =>
        TestBoundedContexts.Create($"party-auth-{Guid.NewGuid():N}");

    private static PartyTaskSubmissionService CreateService(CaseStudyDbContext db)
    {
        var failures = TestInspectorFeeServiceFactory.ShareFailures(db);
        var timeline = TestInspectorFeeServiceFactory.CreateTimeline(db);
        var (notifications, recipients) = TestInspectorFeeServiceFactory.CreateNotificationDeps(db);
        return new(
            new PartyTaskSubmissionRepository(db),
            new PartyTaskFailureGate(new FailureLookup(failures)),
            TestInspectorFeeServiceFactory.CreateWorkflow(db),
            new FieldInspectionAttachmentVerifier(TestInspectorFeeServiceFactory.ShareAttachmentLookup(db)),
            timeline,
            new HttpCurrentPrototypeRoleResolver(new NullHttpContextAccessor(), new NullPermissionService()),
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
