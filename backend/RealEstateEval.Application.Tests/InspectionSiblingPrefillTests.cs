using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using RealEstateEval.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.CaseStudy.Application.Services;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.CaseStudy.Infrastructure.Data.Contexts;
using RealEstateEval.CaseStudy.Infrastructure.Persistence;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// Decision 2026-10-18: a grouped deed's inspection starts from its sibling's — site inputs and
/// photos, copied and editable; never over an inspection the inspector already made.
/// </summary>
public class InspectionSiblingPrefillTests
{
    private static readonly Guid FirstDeed = Guid.Parse("aaaaaaaa-0000-4000-8000-00000000000a");
    private static readonly Guid SecondDeed = Guid.Parse("bbbbbbbb-0000-4000-8000-00000000000b");
    private static readonly Guid SourceTask = Guid.Parse("11111111-0000-4000-8000-000000000011");
    private static readonly Guid TargetTask = Guid.Parse("22222222-0000-4000-8000-000000000022");
    private static readonly Guid FacadePhoto = Guid.Parse("f0000000-0000-4000-8000-000000000001");
    private static readonly Guid SlotPhoto = Guid.Parse("f0000000-0000-4000-8000-000000000002");
    private static readonly Guid FreePhoto = Guid.Parse("f0000000-0000-4000-8000-000000000003");

    private const string SourcePayload =
        """
        {"featureValues":{"assetSubject":"فيلا","facade":"حجر"},
         "streetWidthM":"20","roomCount":"5",
         "featurePhotoAttachments":{"facade":{"fileName":"facade.jpg","mimeType":"image/jpeg","attachmentId":"f0000000-0000-4000-8000-000000000001"}},
         "definedPhotos":{"entrance":{"none":false,"photos":[{"id":1,"approved":true,"fileName":"door.jpg","mimeType":"image/jpeg","attachmentId":"f0000000-0000-4000-8000-000000000002"}]}},
         "freePhotos":[{"id":7,"category":null,"approved":true,"fileName":"yard.jpg","mimeType":"image/jpeg","attachmentId":"f0000000-0000-4000-8000-000000000003"}],
         "boundaryMatches":{"north":{"matches":true}}}
        """;

    /// <summary>Records the copies asked for and answers with fresh ids per source id.</summary>
    private sealed class FakePhotoCopier : IInspectionPhotoCopier
    {
        public List<(Guid From, Guid To)> Calls { get; } = [];
        public Dictionary<Guid, Guid> Map { get; } = new()
        {
            [FacadePhoto] = Guid.Parse("c0000000-0000-4000-8000-000000000001"),
            [SlotPhoto] = Guid.Parse("c0000000-0000-4000-8000-000000000002"),
            [FreePhoto] = Guid.Parse("c0000000-0000-4000-8000-000000000003"),
        };

        public Task<IReadOnlyDictionary<Guid, Guid>> CopyInspectionPhotosAsync(Guid fromTaskId, Guid toTaskId, CancellationToken cancellationToken = default)
        {
            Calls.Add((fromTaskId, toTaskId));
            return Task.FromResult<IReadOnlyDictionary<Guid, Guid>>(Map);
        }
    }

    private static CaseStudyDbContext CreateDb() =>
        new(new DbContextOptionsBuilder<CaseStudyDbContext>()
            .UseInMemoryDatabase($"prefill-{Guid.NewGuid():N}", new InMemoryDatabaseRoot())
            .Options);

    private static PermissionsDto Inspector(string userId = "insp-2") =>
        new() { UserId = userId, PrototypeRole = "field-inspector" };

    private static (InspectionPrefillFromSiblingService Service, FakePhotoCopier Copier, RecordingAuditLogAppend Audit) CreateService(CaseStudyDbContext db)
    {
        var copier = new FakePhotoCopier();
        var audit = new RecordingAuditLogAppend();
        return (new InspectionPrefillFromSiblingService(new PropertyGroupRepository(db), copier, new AuditLogWriter(), audit), copier, audit);
    }

    /// <summary>Two deeds in one group, each with a field-inspection task; the first deed's inspection is submitted.</summary>
    private static void Seed(CaseStudyDbContext db, string? targetPayload = null, bool linked = true)
    {
        var now = DateTime.UtcNow;
        var orderA = new WorkOrder { Id = Guid.NewGuid(), PoNumber = "PO-A", AssignmentType = AssignmentType.Execution, PromulgationDate = DateOnly.FromDateTime(now), ReceivedFromEnfathAt = DateOnly.FromDateTime(now), DueDateAt = DateOnly.FromDateTime(now.AddDays(7)), CreatedAtUtc = now };
        var orderB = new WorkOrder { Id = Guid.NewGuid(), PoNumber = "PO-B", AssignmentType = AssignmentType.Execution, PromulgationDate = DateOnly.FromDateTime(now), ReceivedFromEnfathAt = DateOnly.FromDateTime(now), DueDateAt = DateOnly.FromDateTime(now.AddDays(7)), CreatedAtUtc = now };
        db.WorkOrders.AddRange(orderA, orderB);
        db.WorkOrderProperties.AddRange(
            new WorkOrderProperty { Id = FirstDeed, WorkOrderId = orderA.Id, DeedNumber = "D-1" },
            new WorkOrderProperty { Id = SecondDeed, WorkOrderId = orderB.Id, DeedNumber = "D-2" });
        if (linked)
        {
            var group = new PropertyGroup { Id = Guid.NewGuid(), CreatedAtUtc = now };
            db.PropertyGroups.Add(group);
            db.PropertyGroupMembers.AddRange(
                new PropertyGroupMember { Id = Guid.NewGuid(), GroupId = group.Id, PropertyId = FirstDeed, LinkedByUserId = "spec", LinkedAtUtc = now, IsActive = true },
                new PropertyGroupMember { Id = Guid.NewGuid(), GroupId = group.Id, PropertyId = SecondDeed, LinkedByUserId = "spec", LinkedAtUtc = now, IsActive = true });
        }

        db.WorkflowTasks.AddRange(
            WorkflowTask.Create(WorkflowTaskKind.FieldInspection, "PO-A", now, id: SourceTask, propertyId: FirstDeed, assigneeId: "insp-1"),
            WorkflowTask.Create(WorkflowTaskKind.FieldInspection, "PO-B", now, id: TargetTask, propertyId: SecondDeed, assigneeId: "insp-2"));
        var submitted = PartyTaskSubmission.CreateDraft(SourceTask, WorkflowTaskKindValues.FieldInspection, FirstDeed, "PO-A", now);
        submitted.PayloadJson = SourcePayload;
        submitted.Submit(now, "insp-1", "المعاين الأول", "المعاين");
        db.PartyTaskSubmissions.Add(submitted);
        if (targetPayload is not null)
        {
            var draft = PartyTaskSubmission.CreateDraft(TargetTask, WorkflowTaskKindValues.FieldInspection, SecondDeed, "PO-B", now);
            draft.PayloadJson = targetPayload;
            db.PartyTaskSubmissions.Add(draft);
        }

        db.SaveChanges();
    }

    [Fact]
    public async Task First_open_creates_the_draft_from_the_sibling_with_copied_photos_and_no_boundaries()
    {
        using var db = CreateDb();
        Seed(db);
        var (service, copier, audit) = CreateService(db);

        var (result, error) = await service.PrefillAsync(TargetTask, Inspector());

        Assert.Null(error);
        Assert.True(result!.Prefilled);
        Assert.Equal(3, result.PhotosLinked);
        Assert.True(result.SlotsFilled >= 4);
        Assert.Equal(SourceTask.ToString("D"), result.SourceTaskId);
        Assert.Equal([(SourceTask, TargetTask)], copier.Calls);

        var draft = db.PartyTaskSubmissions.Single(s => s.WorkflowTaskId == TargetTask);
        Assert.Equal(PartyTaskSubmissionStatus.Draft, draft.Status);
        Assert.Equal(SecondDeed, draft.PropertyId);
        Assert.Contains("\"assetSubject\":\"فيلا\"", draft.PayloadJson);
        Assert.Contains("\"streetWidthM\":\"20\"", draft.PayloadJson);
        Assert.Contains("c0000000-0000-4000-8000-000000000001", draft.PayloadJson);   // facade → its copy
        Assert.Contains("c0000000-0000-4000-8000-000000000002", draft.PayloadJson);
        Assert.Contains("c0000000-0000-4000-8000-000000000003", draft.PayloadJson);
        Assert.DoesNotContain("f0000000-0000-4000-8000-000000000001", draft.PayloadJson); // never the original id
        Assert.DoesNotContain("boundaryMatches", draft.PayloadJson);
        Assert.Contains("\"approved\":false", draft.PayloadJson);                         // reviewed afresh
        Assert.DoesNotContain("\"approved\":true", draft.PayloadJson);
        Assert.Single(audit.Entries, e => e.Action == "PROPERTY_GROUP_INSPECTION_PREFILLED");
    }

    [Fact]
    public async Task A_draft_the_inspector_already_started_keeps_its_own_values_and_gets_the_photos()
    {
        using var db = CreateDb();
        Seed(db, targetPayload: """{"featureValues":{"facade":"طوب"},"roomCount":"3"}""");
        var (service, _, _) = CreateService(db);

        var (result, error) = await service.PrefillAsync(TargetTask, Inspector());

        Assert.Null(error);
        Assert.True(result!.Prefilled);
        var draft = db.PartyTaskSubmissions.Single(s => s.WorkflowTaskId == TargetTask);
        Assert.Contains("\"facade\":\"طوب\"", draft.PayloadJson);
        Assert.Contains("\"roomCount\":\"3\"", draft.PayloadJson);
        Assert.Contains("\"assetSubject\":\"فيلا\"", draft.PayloadJson);
        Assert.Equal(3, result.PhotosLinked);
    }

    [Fact]
    public async Task A_draft_that_already_holds_a_photo_is_the_inspectors_word_and_a_second_call_does_nothing()
    {
        using var db = CreateDb();
        Seed(db);
        var (service, copier, _) = CreateService(db);
        var (first, _) = await service.PrefillAsync(TargetTask, Inspector());
        Assert.True(first!.Prefilled);

        var (second, error) = await service.PrefillAsync(TargetTask, Inspector());

        Assert.Null(error);
        Assert.False(second!.Prefilled);
        Assert.Single(copier.Calls);
    }

    [Fact]
    public async Task Only_the_assignee_may_prefill_and_only_a_grouped_deed_has_anything_to_copy()
    {
        using var db = CreateDb();
        Seed(db, linked: false);
        var (service, copier, _) = CreateService(db);

        var (_, forbidden) = await service.PrefillAsync(TargetTask, Inspector("someone-else"));
        Assert.Equal(InspectionPrefillFromSiblingService.NotAllowedAr, forbidden);

        var (result, error) = await service.PrefillAsync(TargetTask, Inspector());
        Assert.Null(error);
        Assert.False(result!.Prefilled);
        Assert.Empty(copier.Calls);

        var (_, missing) = await service.PrefillAsync(Guid.NewGuid(), Inspector());
        Assert.Equal(InspectionPrefillFromSiblingService.TaskNotFoundAr, missing);
    }

    [Fact]
    public void Photos_without_a_copy_are_left_out_and_sections_the_destination_filled_are_kept()
    {
        var copies = new Dictionary<Guid, Guid> { [FacadePhoto] = Guid.Parse("c0000000-0000-4000-8000-000000000001") };
        var destination = """{"freePhotos":[{"id":1,"approved":false,"fileName":"mine.jpg","mimeType":"image/jpeg","attachmentId":"d0000000-0000-4000-8000-000000000009"}]}""";

        var (json, linked) = InspectionSiblingPrefillRules.MergePhotos(SourcePayload, destination, copies);

        Assert.Equal(1, linked);
        Assert.Contains("c0000000-0000-4000-8000-000000000001", json);
        Assert.Contains("mine.jpg", json);           // the destination's own free photo stays
        Assert.DoesNotContain("yard.jpg", json);     // the source's free photo had no copy and the section was taken
        Assert.DoesNotContain("door.jpg", json);     // slot photo without a copy
        Assert.True(InspectionSiblingPrefillRules.HasPhotoRefs(json));
        Assert.False(InspectionSiblingPrefillRules.HasPhotoRefs("{}"));
    }

    [Fact]
    public void The_source_is_the_accepted_or_submitted_sibling_before_any_draft()
    {
        var now = DateTime.UtcNow;
        var draft = PartyTaskSubmission.CreateDraft(Guid.NewGuid(), WorkflowTaskKindValues.FieldInspection, FirstDeed, "PO-A", now.AddDays(1));
        draft.PayloadJson = """{"featureValues":{"assetSubject":"أرض"}}""";
        var submitted = PartyTaskSubmission.CreateDraft(Guid.NewGuid(), WorkflowTaskKindValues.FieldInspection, FirstDeed, "PO-A", now);
        submitted.PayloadJson = SourcePayload;
        submitted.Submit(now, "insp-1", "x", "x");
        var empty = PartyTaskSubmission.CreateDraft(Guid.NewGuid(), WorkflowTaskKindValues.FieldInspection, FirstDeed, "PO-A", now.AddDays(2));

        Assert.Same(submitted, InspectionSiblingPrefillRules.ChooseSource([draft, submitted, empty]));
        Assert.Same(draft, InspectionSiblingPrefillRules.ChooseSource([draft, empty]));
        Assert.Null(InspectionSiblingPrefillRules.ChooseSource([empty]));
        Assert.True(InspectionSiblingPrefillRules.MayPrefill(null));
        Assert.True(InspectionSiblingPrefillRules.MayPrefill(draft));
        Assert.False(InspectionSiblingPrefillRules.MayPrefill(submitted));
    }
}
