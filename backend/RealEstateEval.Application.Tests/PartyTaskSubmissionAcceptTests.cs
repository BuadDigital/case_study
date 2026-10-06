using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Services;
using RealEstateEval.CaseStudy.Infrastructure.Data.Contexts;
using RealEstateEval.Failures.Infrastructure.Data.Contexts;
using RealEstateEval.Operations.Infrastructure.Data.Contexts;
using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.CaseStudy.Application.Services;
using RealEstateEval.CaseStudy.Infrastructure.Persistence;
using RealEstateEval.CaseStudy.Infrastructure.Services;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Financial.Domain;
using RealEstateEval.Failures.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

public class PartyTaskSubmissionAcceptTests
{
    private static readonly Guid TaskId = Guid.Parse("dddddddd-dddd-dddd-dddd-dddddddddddd");
    private static readonly Guid PropertyId = Guid.Parse("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee");

    [Fact]
    public async Task Accept_sets_AcceptedAtUtc_and_exposes_it_on_the_dto()
    {
        var bundle = CreateDb();
        var db = bundle.CaseStudy;
        SeedAcceptedableSurvey(db);
        var audit = new RecordingAuditLogAppend();
        var service = CreateService(db, bundle.Failures, bundle.Ops, audit);

        var (result, errors) = await service.AcceptAsync(
            TaskId,
            new PartySubmissionActor
            {
                UserId = "specialist-1",
                DisplayName = "أخصائي",
                PrototypeRole = "case-specialist",
            });

        Assert.Null(errors);
        Assert.NotNull(result);
        Assert.False(string.IsNullOrWhiteSpace(result!.AcceptedAtUtc));
        Assert.Contains(
            audit.Entries,
            e => e.Action == "case-study.party-submission.accepted"
                && e.EntityType == "PartyTaskSubmission"
                && e.ActorId == "specialist-1");

        var entity = await db.PartyTaskSubmissions.AsNoTracking()
            .SingleAsync(s => s.WorkflowTaskId == TaskId);
        Assert.NotNull(entity.AcceptedAtUtc);
    }

    [Fact]
    public async Task Accept_keeps_the_first_acceptance_timestamp_on_re_accept()
    {
        var bundle = CreateDb();
        var db = bundle.CaseStudy;
        SeedAcceptedableSurvey(db);
        var service = CreateService(db, bundle.Failures, bundle.Ops);

        var actor = new PartySubmissionActor
        {
            UserId = "specialist-1",
            DisplayName = "أخصائي",
            PrototypeRole = "case-specialist",
        };
        var (first, _) = await service.AcceptAsync(TaskId, actor);
        var (second, _) = await service.AcceptAsync(TaskId, actor);

        Assert.NotNull(first);
        Assert.NotNull(second);
        Assert.Equal(first!.AcceptedAtUtc, second!.AcceptedAtUtc);
    }

    [Fact]
    public async Task Get_returns_null_AcceptedAtUtc_before_acceptance()
    {
        var bundle = CreateDb();
        var db = bundle.CaseStudy;
        SeedAcceptedableSurvey(db);
        var service = CreateService(db, bundle.Failures, bundle.Ops);

        var dto = await service.GetAsync(TaskId);

        Assert.NotNull(dto);
        Assert.Null(dto!.AcceptedAtUtc);
    }

    [Fact]
    public async Task Accept_field_inspection_sets_AcceptedAtUtc_without_fee_ledger()
    {
        var bundle = CreateDb();
        var db = bundle.CaseStudy;
        SeedAcceptedableFieldInspection(db);
        var service = CreateService(db, bundle.Failures, bundle.Ops);

        var (result, errors) = await service.AcceptAsync(
            TaskId,
            new PartySubmissionActor
            {
                UserId = "specialist-1",
                DisplayName = "أخصائي",
                PrototypeRole = "case-specialist",
            });

        Assert.Null(errors);
        Assert.NotNull(result);
        Assert.False(string.IsNullOrWhiteSpace(result!.AcceptedAtUtc));

        var entity = await db.PartyTaskSubmissions.AsNoTracking()
            .SingleAsync(s => s.WorkflowTaskId == TaskId);
        Assert.NotNull(entity.AcceptedAtUtc);
        Assert.Equal("specialist-1", entity.AcceptedByUserId);
        Assert.Equal("أخصائي", entity.AcceptedByName);

        var fin = TestInspectorFeeServiceFactory.ShareFinancial(db);
        Assert.False(await fin.InspectorFeeLedgers.AnyAsync(l => l.WorkflowTaskId == TaskId));
    }

    [Fact]
    public async Task Accept_field_inspection_requires_the_specialist_components_first()
    {
        var bundle = CreateDb();
        var db = bundle.CaseStudy;
        SeedAcceptedableFieldInspection(db, payloadJson: "{}");
        db.WorkOrderProperties.Add(new WorkOrderProperty
        {
            Id = PropertyId,
            WorkOrderId = Guid.NewGuid(),
            DeedNumber = "DEED-502",
            HasStructuresToValue = HasStructuresToValueValues.Yes,
        });
        db.SaveChanges();
        var service = CreateService(db, bundle.Failures, bundle.Ops);
        var actor = new PartySubmissionActor
        {
            UserId = "specialist-1",
            DisplayName = "أخصائي",
            PrototypeRole = "case-specialist",
        };

        // Nothing written yet: both the text and the inventory table are reported at once.
        var (_, noText) = await service.AcceptAsync(TaskId, actor);
        Assert.Equal(SpecialistComponentsRules.TextRequired, noText!["componentsText"]);
        Assert.Equal(SpecialistComponentsRules.InventoryRequired, noText["inventoryLines"]);

        var property = db.WorkOrderProperties.Single(p => p.Id == PropertyId);
        property.SpecialistComponentsText = "فيلا من دورين";
        db.SaveChanges();
        // The text alone no longer clears the gate — a property with structures needs a table line.
        var (_, noLines) = await service.AcceptAsync(TaskId, actor);
        Assert.False(noLines!.ContainsKey("componentsText"));
        Assert.Equal(SpecialistComponentsRules.InventoryRequired, noLines["inventoryLines"]);

        db.BuildingInventoryLines.Add(new BuildingInventoryLine
        {
            Id = Guid.NewGuid(),
            PropertyId = PropertyId,
            StructureKind = "floor",
            Label = "الدور الأرضي",
        });
        db.SaveChanges();
        var (result, errors) = await service.AcceptAsync(TaskId, actor);
        Assert.Null(errors);
        Assert.NotNull(result);
        Assert.False(string.IsNullOrWhiteSpace(result!.AcceptedAtUtc));
    }

    private async Task<(PartyTaskSubmissionDto? Result, Dictionary<string, string>? Errors)> AcceptInspectedAsync(
        string inspectedType,
        string payloadJson)
    {
        var bundle = CreateDb();
        var db = bundle.CaseStudy;
        SeedAcceptedableFieldInspection(db, payloadJson);
        db.WorkOrderProperties.Add(new WorkOrderProperty
        {
            Id = PropertyId,
            WorkOrderId = Guid.NewGuid(),
            DeedNumber = "DEED-503",
            PropertyType = inspectedType,
            InspectedPropertyType = inspectedType,
            SpecialistComponentsText = "وصف المكونات",
        });
        db.SaveChanges();
        var service = CreateService(db, bundle.Failures, bundle.Ops);

        return await service.AcceptAsync(
            TaskId,
            new PartySubmissionActor
            {
                UserId = "specialist-1",
                DisplayName = "أخصائي",
                PrototypeRole = "case-specialist",
            });
    }

    [Fact]
    public async Task Accept_field_inspection_of_a_land_with_valuable_structures_requires_the_inventory_table()
    {
        var (result, errors) = await AcceptInspectedAsync("أرض", """{"landHasValuableStructures":"yes"}""");

        Assert.Null(result);
        Assert.Equal(SpecialistComponentsRules.InventoryRequired, errors!["inventoryLines"]);
        Assert.False(errors.ContainsKey("componentsText"));
    }

    [Fact]
    public async Task Accept_field_inspection_of_a_land_with_irrelevant_annexes_needs_no_inventory_table()
    {
        var (result, errors) = await AcceptInspectedAsync("أرض", """{"landHasValuableStructures":"no"}""");

        Assert.Null(errors);
        Assert.NotNull(result);
    }

    [Fact]
    public async Task Accept_field_inspection_of_a_legacy_land_submission_without_the_answer_is_exempt()
    {
        var (result, errors) = await AcceptInspectedAsync("أرض", "{}");

        Assert.Null(errors);
        Assert.NotNull(result);
    }

    [Theory]
    [InlineData("{}")]
    [InlineData("""{"landHasValuableStructures":"no"}""")]
    public async Task Accept_field_inspection_of_a_non_land_asset_always_requires_the_inventory_table(string payloadJson)
    {
        var (result, errors) = await AcceptInspectedAsync("فيلا", payloadJson);

        Assert.Null(result);
        Assert.Equal(SpecialistComponentsRules.InventoryRequired, errors!["inventoryLines"]);
    }

    [Fact]
    public async Task Accept_field_inspection_mirrors_inspector_deed_boundaries_onto_the_property()
    {
        var bundle = CreateDb();
        var db = bundle.CaseStudy;
        SeedAcceptedableFieldInspection(
            db,
            payloadJson:
                """
                {"boundaryMatches":{
                  "north":{"deedDesc":"رقم 11","deedLength":"40.28","facade":"","matches":true,"mismatchNote":""},
                  "south":{"deedDesc":"","deedLength":"38.50","facade":"","matches":true,"mismatchNote":""},
                  "east":{"deedDesc":"  ","deedLength":"","facade":"","matches":false,"mismatchNote":"فرق"}
                }}
                """);
        db.WorkOrderProperties.Add(new WorkOrderProperty
        {
            Id = PropertyId,
            WorkOrderId = Guid.NewGuid(),
            DeedNumber = "DEED-501",
            NorthBoundary = "شارع عرض 15م",
            NorthBoundaryLengthM = "25.00",
            NorthBoundaryType = "street",
            SouthBoundary = "قطعة 12",
            SouthBoundaryLengthM = "25.00",
            EastBoundary = "قطعة 13",
            EastBoundaryLengthM = "25.00",
            WestBoundary = "ممر",
            WestBoundaryLengthM = "25.00",
            SpecialistComponentsText = "فيلا من دورين",
            HasStructuresToValue = HasStructuresToValueValues.Yes,
        });
        db.BuildingInventoryLines.Add(new BuildingInventoryLine
        {
            Id = Guid.NewGuid(),
            PropertyId = PropertyId,
            StructureKind = "floor",
            Label = "الدور الأرضي",
            ItemKey = "ground_floor",
            AreaSqm = "200",
        });
        db.SaveChanges();
        var service = CreateService(db, bundle.Failures, bundle.Ops);

        var (result, errors) = await service.AcceptAsync(
            TaskId,
            new PartySubmissionActor
            {
                UserId = "specialist-1",
                DisplayName = "أخصائي",
                PrototypeRole = "case-specialist",
            });

        Assert.Null(errors);
        Assert.NotNull(result);

        var property = await db.WorkOrderProperties.AsNoTracking().SingleAsync(p => p.Id == PropertyId);
        Assert.Equal("رقم 11", property.NorthBoundary);
        Assert.Equal("40.28", property.NorthBoundaryLengthM);
        Assert.Equal("street", property.NorthBoundaryType);
        // Blank inspector text keeps the intake value; a recorded length still lands.
        Assert.Equal("قطعة 12", property.SouthBoundary);
        Assert.Equal("38.50", property.SouthBoundaryLengthM);
        // Whitespace-only text and an empty length change nothing.
        Assert.Equal("قطعة 13", property.EastBoundary);
        Assert.Equal("25.00", property.EastBoundaryLengthM);
        // A side missing from the payload is untouched.
        Assert.Equal("ممر", property.WestBoundary);
        Assert.Equal("25.00", property.WestBoundaryLengthM);
    }

    private static void SeedAcceptedableFieldInspection(CaseStudyDbContext db, string payloadJson = "{}")
    {
        var now = DateTime.UtcNow;
        db.WorkflowTasks.Add(WorkflowTask.Create(
            WorkflowTaskKind.FieldInspection,
            "PO-501",
            now,
            title: "معاينة",
            phase: WorkflowTaskPhase.Done,
            status: WorkflowTaskStatus.Completed,
            id: TaskId,
            propertyId: PropertyId));
        db.PartyTaskSubmissions.Add(new PartyTaskSubmission
        {
            Id = Guid.NewGuid(),
            WorkflowTaskId = TaskId,
            Kind = "field-inspection",
            Status = PartyTaskSubmissionStatus.Submitted,
            PropertyId = PropertyId,
            PoNumber = "PO-501",
            PayloadJson = payloadJson,
            SubmittedAtUtc = now,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        });
        db.SaveChanges();
    }

    private static void SeedAcceptedableSurvey(CaseStudyDbContext db)
    {
        var now = DateTime.UtcNow;
        db.WorkflowTasks.Add(WorkflowTask.Create(
            WorkflowTaskKind.EngineeringSurvey,
            "PO-500",
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
            PoNumber = "PO-500",
            PayloadJson = "{}",
            SubmittedAtUtc = now,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        });
 // Ledger already accrued: the fee guard short-circuits so acceptance
 // exercises only the new AcceptedAtUtc persistence, no pricing needed.
        var fin = TestInspectorFeeServiceFactory.ShareFinancial(db);
        fin.InspectorFeeLedgers.Add(new InspectorFeeLedger
        {
            WorkflowTaskId = TaskId,
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

    private static TestBoundedContexts.Bundle CreateDb() =>
        TestBoundedContexts.Create($"party-accept-{Guid.NewGuid():N}");

    private static PartyTaskSubmissionService CreateService(
        CaseStudyDbContext db,
        FailuresDbContext failures,
        OperationsDbContext __,
        RecordingAuditLogAppend? audit = null)
    {
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
            recipients,
            new AuditLogWriter(),
            audit ?? new RecordingAuditLogAppend());
    }

    private sealed class NullHttpContextAccessor : IHttpContextAccessor
    {
        public HttpContext? HttpContext { get; set; }
    }

    private sealed class NullPermissionService : IPermissionService
    {
        public Task<PermissionsDto?> GetForUserIdAsync(string userId, CancellationToken cancellationToken = default)
        {
            return Task.FromResult<PermissionsDto?>(null);
        }
    }
}
