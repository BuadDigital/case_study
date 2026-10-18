using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.CaseStudy.Application.Services;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.CaseStudy.Infrastructure.Data.Contexts;
using RealEstateEval.CaseStudy.Infrastructure.Persistence;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// Decision 2026-10-15: confirming a grouped-property link copies the two deeds' data into each
/// other's empty slots — once, never over what a person typed.
/// </summary>
public class PropertyGroupServiceTests
{
    private static readonly Guid SubjectId = Guid.Parse("aaaaaaaa-0000-4000-8000-000000000001");
    private static readonly Guid TargetId = Guid.Parse("bbbbbbbb-0000-4000-8000-000000000002");

    private static CaseStudyDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<CaseStudyDbContext>()
            .UseInMemoryDatabase($"groups-{Guid.NewGuid():N}", new InMemoryDatabaseRoot())
            .Options);

    private static (PropertyGroupService Service, RecordingAuditLogAppend Audit) CreateService(CaseStudyDbContext db)
    {
        var audit = new RecordingAuditLogAppend();
        return (new PropertyGroupService(new PropertyGroupRepository(db), new AuditLogWriter(), audit), audit);
    }

    private static WorkOrder Order(string po)
    {
        var now = DateTime.UtcNow;
        return new WorkOrder
        {
            Id = Guid.NewGuid(),
            PoNumber = po,
            AssignmentType = AssignmentType.Execution,
            PromulgationDate = DateOnly.FromDateTime(now),
            ReceivedFromEnfathAt = DateOnly.FromDateTime(now),
            DueDateAt = DateOnly.FromDateTime(now.AddDays(7)),
            CreatedAtUtc = now,
        };
    }

    /// <summary>Two deeds on two orders: the subject is filled in, the target is bare.</summary>
    private static void SeedPair(CaseStudyDbContext db, Action<WorkOrderProperty>? target = null)
    {
        var first = Order("PO-G1");
        var second = Order("PO-G2");
        db.WorkOrders.AddRange(first, second);
        db.WorkOrderProperties.Add(new WorkOrderProperty
        {
            Id = SubjectId,
            WorkOrderId = first.Id,
            DeedNumber = "DEED-1",
            OwnerName = "خالد الدوسري",
            City = "الرياض",
            District = "الياسمين",
            PlanNumber = "م/3010",
            PlotNumber = "45",
            Area = "600",
            NorthBoundary = "شارع عرض 20م",
            Court = "محكمة التنفيذ بالرياض",
            CourtId = Guid.Parse("cccccccc-0000-4000-8000-000000000003"),
            Classification = "سكني",
            PropertyType = "فيلا",
            Contacts =
            {
                new PropertyContact { Id = Guid.NewGuid(), PropertyId = SubjectId, Name = "خالد", Role = "مالك", Phone = "0556123456", NationalId = "1045678901", SortOrder = 0 },
            },
        });
        var bare = new WorkOrderProperty
        {
            Id = TargetId,
            WorkOrderId = second.Id,
            DeedNumber = "DEED-2",
            PlotNumber = "46",
        };
        target?.Invoke(bare);
        db.WorkOrderProperties.Add(bare);
        db.SaveChanges();
    }

    [Fact]
    public async Task Confirming_a_link_fills_the_bare_deed_from_the_filled_one_and_keeps_the_deed_fields_apart()
    {
        using var db = CreateDb();
        SeedPair(db);
        var (service, audit) = CreateService(db);

        var (result, error) = await service.ConfirmLinkAsync(SubjectId, TargetId, "spec-1");

        Assert.Null(error);
        var target = db.WorkOrderProperties.Include(p => p.Contacts).Single(p => p.Id == TargetId);
        Assert.Equal("خالد الدوسري", target.OwnerName);
        Assert.Equal("الرياض", target.City);
        Assert.Equal("الياسمين", target.District);
        Assert.Equal("م/3010", target.PlanNumber);
        Assert.Equal("محكمة التنفيذ بالرياض", target.Court);
        Assert.Equal(Guid.Parse("cccccccc-0000-4000-8000-000000000003"), target.CourtId);
        Assert.Equal("فيلا", target.PropertyType);
        // Per-deed fields never travel.
        Assert.Equal("DEED-2", target.DeedNumber);
        Assert.Equal("46", target.PlotNumber);
        Assert.Null(target.Area);
        Assert.Null(target.NorthBoundary);
        // Contacts came along as fresh rows.
        var contact = Assert.Single(target.Contacts);
        Assert.Equal("خالد", contact.Name);
        Assert.Equal(TargetId, contact.PropertyId);

        var sync = result!.LinkSync!;
        Assert.Contains("ownerName", sync.TargetFieldsFilled);
        Assert.Contains("courtId", sync.TargetFieldsFilled);
        Assert.Empty(sync.SubjectFieldsFilled);
        Assert.True(sync.ContactsCopiedToTarget);
        Assert.False(sync.ContactsCopiedToSubject);

        var entry = Assert.Single(audit.Entries, e => e.Action == "PROPERTY_GROUP_LINK_CONFIRMED");
        Assert.Contains("ownerName", entry.AfterJson);
    }

    [Fact]
    public async Task What_a_person_typed_on_either_deed_is_never_overwritten_and_the_copy_runs_both_ways()
    {
        using var db = CreateDb();
        SeedPair(db, target =>
        {
            target.OwnerName = "شركة النخيل";      // typed on the target: stays
            target.FinishingType = "فاخر";          // only the target has it: travels to the subject
            target.Contacts.Add(new PropertyContact { Id = Guid.NewGuid(), PropertyId = TargetId, Name = "سعد", Role = "وكيل", Phone = "0500000000", NationalId = "1", SortOrder = 0 });
        });
        var (service, _) = CreateService(db);

        var (result, error) = await service.ConfirmLinkAsync(SubjectId, TargetId, "spec-1");

        Assert.Null(error);
        var subject = db.WorkOrderProperties.Include(p => p.Contacts).Single(p => p.Id == SubjectId);
        var target = db.WorkOrderProperties.Include(p => p.Contacts).Single(p => p.Id == TargetId);
        Assert.Equal("شركة النخيل", target.OwnerName);
        Assert.Equal("خالد الدوسري", subject.OwnerName);
        Assert.Equal("فاخر", subject.FinishingType);
        Assert.Equal("الرياض", target.City);
        // Each side already had contacts: none copied either way.
        Assert.Single(subject.Contacts);
        Assert.Single(target.Contacts);
        Assert.Equal(["finishingType"], result!.LinkSync!.SubjectFieldsFilled);
        Assert.DoesNotContain("ownerName", result.LinkSync.TargetFieldsFilled);
        Assert.False(result.LinkSync.ContactsCopiedToTarget);
    }

    [Fact]
    public async Task A_draft_inspection_of_the_bare_deed_takes_the_sibling_inspectors_site_inputs_but_not_boundaries_or_photos()
    {
        using var db = CreateDb();
        SeedPair(db);
        var now = DateTime.UtcNow;
        var sourceTask = WorkflowTask.Create(WorkflowTaskKind.FieldInspection, "PO-G1", now, propertyId: SubjectId, assigneeId: "insp-1");
        var targetTask = WorkflowTask.Create(WorkflowTaskKind.FieldInspection, "PO-G2", now, propertyId: TargetId, assigneeId: "insp-2");
        db.WorkflowTasks.AddRange(sourceTask, targetTask);
        var submitted = PartyTaskSubmission.CreateDraft(sourceTask.Id, WorkflowTaskKindValues.FieldInspection, SubjectId, "PO-G1", now);
        submitted.PayloadJson =
            """
            {"featureValues":{"assetSubject":"فيلا","facade":"حجر"},
             "streetWidthM":"20","roomCount":"5","vacantLand":false,
             "featurePhotoAttachments":{"facade":{"attachmentId":"x"}},
             "boundaryMatches":{"north":{"matches":true}},
             "mapLatitude":"24.7","mapLongitude":"46.6"}
            """;
        submitted.Submit(now, "insp-1", "المعاين", "المعاين");
        var draft = PartyTaskSubmission.CreateDraft(targetTask.Id, WorkflowTaskKindValues.FieldInspection, TargetId, "PO-G2", now);
        draft.PayloadJson = """{"featureValues":{"facade":"طوب"},"roomCount":""}""";
        db.PartyTaskSubmissions.AddRange(submitted, draft);
        db.SaveChanges();
        var (service, _) = CreateService(db);

        var (result, error) = await service.ConfirmLinkAsync(SubjectId, TargetId, "spec-1");

        Assert.Null(error);
        var merged = db.PartyTaskSubmissions.Single(s => s.Id == draft.Id).PayloadJson;
        Assert.Contains("\"assetSubject\":\"فيلا\"", merged);
        Assert.Contains("\"facade\":\"طوب\"", merged);          // typed by the target's inspector: kept
        Assert.Contains("\"streetWidthM\":\"20\"", merged);
        Assert.Contains("\"roomCount\":\"5\"", merged);           // was blank: filled
        Assert.Contains("\"mapLatitude\":\"24.7\"", merged);
        Assert.DoesNotContain("featurePhotoAttachments", merged);
        Assert.DoesNotContain("boundaryMatches", merged);
        Assert.Equal(0, result!.LinkSync!.InspectorSlotsFilledOnSubject);
        Assert.True(result.LinkSync.InspectorSlotsFilledOnTarget >= 4);
        // The submitted inspection itself is untouched.
        Assert.Equal(PartyTaskSubmissionStatus.Submitted, db.PartyTaskSubmissions.Single(s => s.Id == submitted.Id).Status);
    }

    [Fact]
    public async Task Document_names_are_recorded_into_empty_slots_only()
    {
        using var db = CreateDb();
        SeedPair(db, target => target.DeedOwnershipFileName = "صك-2.pdf");
        var (service, audit) = CreateService(db);

        var (result, error) = await service.FillDocumentNamesAsync(
            TargetId,
            new FillPropertyGroupDocumentNamesRequest
            {
                DelegationLetterFileNames = ["خطاب التكليف.pdf"],
                AssignmentDocFileNames = [],
                DeedOwnershipFileName = "صك-1.pdf",
                BourseDeedImageFileName = " ",
            },
            "spec-1");

        Assert.Null(error);
        Assert.Equal(["delegationLetterFileNames"], result!.Filled);
        var target = db.WorkOrderProperties.Single(p => p.Id == TargetId);
        Assert.Equal(["خطاب التكليف.pdf"], PropertyFileNameList.Parse(target.DelegationLetterFileName));
        Assert.Equal("صك-2.pdf", target.DeedOwnershipFileName);
        Assert.Null(target.AssignmentDocFileName);
        Assert.Single(audit.Entries, e => e.Action == "PROPERTY_GROUP_DOCUMENTS_COPIED");

        var (_, missing) = await service.FillDocumentNamesAsync(Guid.NewGuid(), new FillPropertyGroupDocumentNamesRequest(), "spec-1");
        Assert.Equal("العقار غير موجود", missing);
    }

    [Fact]
    public void The_shared_field_list_never_carries_a_deed_identity()
    {
        foreach (var perDeed in new[] { "deedNumber", "deedDate", "realEstateRegNumber", "plotNumber", "area", "northBoundary", "requestNumber", "assignmentMandateNumber", "partitionMinutesNumber" })
            Assert.DoesNotContain(perDeed, PropertyGroupDataSyncRules.SharedFieldNames);
        Assert.Contains("ownerName", PropertyGroupDataSyncRules.SharedFieldNames);
        Assert.Contains("cityId", PropertyGroupDataSyncRules.SharedFieldNames);
    }
}
