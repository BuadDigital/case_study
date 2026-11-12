using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
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
using RealEstateEval.Failures.Infrastructure.Services;
using RealEstateEval.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// Omar 2026-11-12: the study specialist changes the property type too (until then only the inspector
/// could, by a return) — from the system's list, with a reason, until review approves the study; and
/// «استخدام العقار» with it. The inspector's answers a type hides are kept, not erased.
/// </summary>
public class InspectedTypeStaffCorrectionTests
{
    private static readonly Guid TaskId = Guid.Parse("abababab-abab-abab-abab-abababababab");
    private static readonly Guid PropertyId = Guid.Parse("cdcdcdcd-cdcd-cdcd-cdcd-cdcdcdcdcdcd");
    private static readonly Guid TransactionId = Guid.Parse("efefefef-efef-efef-efef-efefefefefef");

    private const string VillaPayload =
        """{"featureValues":{"assetSubject":"فيلا","facade":"شمالية","buildState":"جيد","propertyUsage":"سكني"},"featurePhotoAttachments":{"facade":{"fileName":"facade.jpg"}},"streetName":"الملك فهد"}""";

    private const string Reason = "الصك أرض فضاء والمبنى أزيل";

    private static readonly PartySubmissionActor Specialist = new()
    {
        UserId = "specialist-1",
        DisplayName = "أخصائي الدراسة",
        PrototypeRole = "case-specialist",
        SubRoles = [CaseSpecialistSubRoles.Study],
    };

    [Fact]
    public void A_staff_correction_sets_the_type_without_emptying_the_building_answers()
    {
        var result = InspectedPropertyTypeRules.ApplyStaffCorrection(VillaPayload, "أرض سكنية", null);

        Assert.Equal("أرض سكنية", InspectedPropertyTypeRules.FromPayload(result));
        using var doc = JsonDocument.Parse(result);
        Assert.True(doc.RootElement.GetProperty("vacantLand").GetBoolean());
        var values = doc.RootElement.GetProperty("featureValues");
        Assert.Equal("شمالية", values.GetProperty("facade").GetString());
        Assert.Equal("سكني", values.GetProperty("propertyUsage").GetString());
        Assert.Equal(
            "facade.jpg",
            doc.RootElement.GetProperty("featurePhotoAttachments").GetProperty("facade").GetProperty("fileName").GetString());
    }

    [Fact]
    public void A_staff_correction_of_the_usage_alone_leaves_the_type_as_it_is()
    {
        var result = InspectedPropertyTypeRules.ApplyStaffCorrection(VillaPayload, null, " تجاري ");

        Assert.Equal("فيلا", InspectedPropertyTypeRules.FromPayload(result));
        Assert.Equal("تجاري", InspectedUsageRules.FromPayload(result));
        Assert.DoesNotContain("vacantLand", result);
    }

    [Fact]
    public void A_staff_save_keeps_the_answers_the_type_hides()
    {
        const string stored =
            """{"featureValues":{"assetSubject":"أرض سكنية","facade":"شمالية","buildState":"جيد"},"featurePhotoAttachments":{"facade":{"fileName":"facade.jpg"}}}""";
        // What the screen sends for a land: the building rows blank, their photos gone, one real edit.
        const string incoming =
            """{"featureValues":{"assetSubject":"أرض سكنية","facade":"","zoneStatus":"موقوفة"},"featurePhotoAttachments":{}}""";

        var kept = InspectedPropertyTypeRules.KeepHiddenValuesOnStaffCorrection(stored, incoming);

        using var doc = JsonDocument.Parse(kept);
        var values = doc.RootElement.GetProperty("featureValues");
        Assert.Equal("شمالية", values.GetProperty("facade").GetString());
        Assert.Equal("جيد", values.GetProperty("buildState").GetString());
        Assert.Equal("موقوفة", values.GetProperty("zoneStatus").GetString());
        Assert.Equal(
            "facade.jpg",
            doc.RootElement.GetProperty("featurePhotoAttachments").GetProperty("facade").GetProperty("fileName").GetString());
    }

    [Fact]
    public void A_type_that_hides_nothing_passes_the_staff_save_through_untouched()
    {
        const string stored = """{"featureValues":{"assetSubject":"فيلا","facade":"شمالية"}}""";
        // The specialist really cleared the facade of a villa: nothing is put back.
        const string incoming = """{"featureValues":{"assetSubject":"فيلا","facade":""}}""";

        Assert.Same(incoming, InspectedPropertyTypeRules.KeepHiddenValuesOnStaffCorrection(stored, incoming));
        Assert.Same("not json", InspectedPropertyTypeRules.KeepHiddenValuesOnStaffCorrection(stored, "not json"));
    }

    [Fact]
    public void An_apartment_keeps_only_its_hidden_facade()
    {
        const string stored = """{"featureValues":{"assetSubject":"شقة سكنية","facade":"شمالية","buildState":"جيد"}}""";
        const string incoming = """{"featureValues":{"assetSubject":"شقة سكنية","facade":"","buildState":""}}""";

        using var doc = JsonDocument.Parse(
            InspectedPropertyTypeRules.KeepHiddenValuesOnStaffCorrection(stored, incoming));
        var values = doc.RootElement.GetProperty("featureValues");
        Assert.Equal("شمالية", values.GetProperty("facade").GetString());
        // «حالة البناء» shows for an apartment, so an emptied one is the specialist's own edit.
        Assert.Equal("", values.GetProperty("buildState").GetString());
    }

    [Theory]
    [InlineData(null)]
    [InlineData("قصير")]
    [InlineData("   تسعة أحرف ")]
    public void A_short_reason_is_no_reason(string? reason) =>
        Assert.Null(InspectedPropertyTypeRules.StaffChangeReason(reason));

    [Fact]
    public async Task The_specialist_changes_the_type_of_an_accepted_inspection_with_a_reason()
    {
        var bundle = CreateDb();
        var db = bundle.CaseStudy;
        Seed(db, accepted: true);
        var audit = new RecordingAuditLogAppend();
        var service = CreateService(bundle, audit);

        var (result, errors) = await service.CorrectInspectedTypeAsync(
            TaskId,
            new CorrectInspectedTypeRequest { PropertyType = "أرض سكنية", Reason = Reason },
            Specialist);

        Assert.Null(errors);
        Assert.NotNull(result);
        // Still submitted and still accepted — the correction is not a return.
        Assert.Equal("submitted", result!.Status);
        Assert.False(string.IsNullOrWhiteSpace(result.AcceptedAtUtc));

        var property = await db.WorkOrderProperties.AsNoTracking().SingleAsync(p => p.Id == PropertyId);
        Assert.Equal("أرض سكنية", property.InspectedPropertyType);
        // The bourse type stays for the record.
        Assert.Equal("فيلا", property.PropertyType);

        var stored = await db.PartyTaskSubmissions.AsNoTracking().SingleAsync(s => s.WorkflowTaskId == TaskId);
        Assert.Equal("أرض سكنية", InspectedPropertyTypeRules.FromPayload(stored.PayloadJson));
        using (var doc = JsonDocument.Parse(stored.PayloadJson))
        {
            Assert.Equal("شمالية", doc.RootElement.GetProperty("featureValues").GetProperty("facade").GetString());
        }

        var row = await db.PropertyTimelineEntries.AsNoTracking()
            .SingleAsync(e => e.PropertyId == PropertyId && e.Title == "تعديل نوع العقار من الأخصائي");
        Assert.Contains("من «فيلا» إلى «أرض سكنية»", row.Detail);
        Assert.Contains("أخصائي الدراسة", row.Detail);
        Assert.Contains(Reason, row.Detail);
        Assert.Contains(
            audit.Entries,
            e => e.Action == "case-study.property.inspected-type-changed" && e.ActorId == "specialist-1");
    }

    [Fact]
    public async Task A_new_type_needs_a_reason_and_a_listed_type()
    {
        var bundle = CreateDb();
        Seed(bundle.CaseStudy);
        var service = CreateService(bundle);

        var (noReason, noReasonErrors) = await service.CorrectInspectedTypeAsync(
            TaskId,
            new CorrectInspectedTypeRequest { PropertyType = "أرض سكنية", Reason = "قصير" },
            Specialist);
        Assert.Null(noReason);
        Assert.Equal(InspectedPropertyTypeRules.StaffChangeReasonRequiredAr, noReasonErrors!["reason"]);

        var (unlisted, unlistedErrors) = await service.CorrectInspectedTypeAsync(
            TaskId,
            new CorrectInspectedTypeRequest { PropertyType = "نوع غير موجود", Reason = Reason },
            Specialist);
        Assert.Null(unlisted);
        Assert.Equal(InspectedPropertyTypeRules.StaffChangeTypeInvalidAr, unlistedErrors!["propertyType"]);

        var property = await bundle.CaseStudy.WorkOrderProperties.AsNoTracking().SingleAsync(p => p.Id == PropertyId);
        Assert.Equal("فيلا", property.InspectedPropertyType);
    }

    [Fact]
    public async Task The_usage_alone_changes_without_a_reason()
    {
        var bundle = CreateDb();
        var db = bundle.CaseStudy;
        Seed(db, accepted: true);
        var service = CreateService(bundle);

        var (result, errors) = await service.CorrectInspectedTypeAsync(
            TaskId,
            new CorrectInspectedTypeRequest { PropertyType = "فيلا", PropertyUsage = "سكني تجاري" },
            Specialist);

        Assert.Null(errors);
        Assert.NotNull(result);
        var property = await db.WorkOrderProperties.AsNoTracking().SingleAsync(p => p.Id == PropertyId);
        Assert.Equal("سكني تجاري", property.InspectedUsage);
        Assert.Equal("فيلا", property.InspectedPropertyType);
        var titles = await db.PropertyTimelineEntries.AsNoTracking()
            .Where(e => e.PropertyId == PropertyId)
            .Select(e => e.Title)
            .ToListAsync();
        Assert.Contains("تعديل استخدام العقار من الأخصائي", titles);
        Assert.DoesNotContain("تعديل نوع العقار من الأخصائي", titles);
    }

    [Fact]
    public async Task Nothing_new_changes_nothing()
    {
        var bundle = CreateDb();
        var db = bundle.CaseStudy;
        Seed(db);
        var service = CreateService(bundle);

        var (result, errors) = await service.CorrectInspectedTypeAsync(
            TaskId,
            new CorrectInspectedTypeRequest { PropertyType = "فيلا", PropertyUsage = "سكني" },
            Specialist);

        Assert.Null(errors);
        Assert.NotNull(result);
        Assert.False(await db.PropertyTimelineEntries.AsNoTracking().AnyAsync(e => e.PropertyId == PropertyId));
    }

    [Fact]
    public async Task Review_approval_locks_the_type_like_the_rest_of_the_data()
    {
        var bundle = CreateDb();
        var db = bundle.CaseStudy;
        Seed(db, accepted: true, reviewApproved: true);
        var service = CreateService(bundle);

        var (result, errors) = await service.CorrectInspectedTypeAsync(
            TaskId,
            new CorrectInspectedTypeRequest { PropertyType = "أرض سكنية", Reason = Reason },
            Specialist);

        Assert.Null(result);
        Assert.Equal(WorkOrderPropertyWriteRules.ReviewApprovedLockAr, errors!["_"]);
    }

    [Fact]
    public async Task A_transaction_delivered_to_Enfaz_is_frozen_even_without_the_review_stamp()
    {
        // The first live run (PO-AZ-2026-220): a transaction handed over before the review stamp
        // existed carried no approval, and its type could still be changed.
        var bundle = CreateDb();
        var db = bundle.CaseStudy;
        Seed(db, accepted: true);
        var property = await db.WorkOrderProperties.SingleAsync(p => p.Id == PropertyId);
        property.EnfazHandoverAtUtc = DateTime.UtcNow;
        await db.SaveChangesAsync();
        var service = CreateService(bundle);

        var (result, errors) = await service.CorrectInspectedTypeAsync(
            TaskId,
            new CorrectInspectedTypeRequest { PropertyType = "أرض سكنية", Reason = Reason },
            Specialist);

        Assert.Null(result);
        Assert.Equal(PartyTaskSubmissionService.HandedOverToEnfazAr, errors!["_"]);
        Assert.Equal(
            "فيلا",
            (await db.WorkOrderProperties.AsNoTracking().SingleAsync(p => p.Id == PropertyId)).InspectedPropertyType);
    }

    [Fact]
    public async Task The_inspector_and_a_returned_package_are_refused()
    {
        var bundle = CreateDb();
        var db = bundle.CaseStudy;
        Seed(db);
        var service = CreateService(bundle);
        var request = new CorrectInspectedTypeRequest { PropertyType = "أرض سكنية", Reason = Reason };

        var (_, inspectorErrors) = await service.CorrectInspectedTypeAsync(
            TaskId,
            request,
            new PartySubmissionActor { UserId = "inspector-1", PrototypeRole = "field-inspector" });
        Assert.Contains("صلاحية", inspectorErrors!["_"]);

        var submission = await db.PartyTaskSubmissions.SingleAsync(s => s.WorkflowTaskId == TaskId);
        submission.Status = PartyTaskSubmissionStatus.Reopened;
        await db.SaveChangesAsync();

        var (returned, returnedErrors) = await service.CorrectInspectedTypeAsync(TaskId, request, Specialist);
        Assert.Null(returned);
        Assert.Contains("بعد أن يرسل المعاين", returnedErrors!["_"]);
    }

    [Fact]
    public async Task The_staff_autosave_still_cannot_change_the_type_and_keeps_the_hidden_answers()
    {
        var bundle = CreateDb();
        var db = bundle.CaseStudy;
        Seed(db);
        var service = CreateService(bundle);
        await service.CorrectInspectedTypeAsync(
            TaskId,
            new CorrectInspectedTypeRequest { PropertyType = "أرض سكنية", Reason = Reason },
            Specialist);

        var (changed, changedErrors) = await service.SaveDraftAsync(
            TaskId,
            new SavePartyTaskSubmissionRequest
            {
                Payload = Parse("""{"featureValues":{"assetSubject":"عمارة"}}"""),
            },
            Specialist);
        Assert.Null(changed);
        Assert.True(changedErrors!.ContainsKey("assetSubject"));

        // The review screen of a land sends the building rows blank — the inspector's stay stored.
        var (saved, errors) = await service.SaveDraftAsync(
            TaskId,
            new SavePartyTaskSubmissionRequest
            {
                Payload = Parse("""{"featureValues":{"assetSubject":"أرض سكنية","facade":"","propertyUsage":"سكني"},"streetName":"طريق مكة"}"""),
            },
            Specialist);
        Assert.Null(errors);
        Assert.NotNull(saved);
        var stored = await db.PartyTaskSubmissions.AsNoTracking().SingleAsync(s => s.WorkflowTaskId == TaskId);
        using var doc = JsonDocument.Parse(stored.PayloadJson);
        Assert.Equal("شمالية", doc.RootElement.GetProperty("featureValues").GetProperty("facade").GetString());
        Assert.Equal("طريق مكة", doc.RootElement.GetProperty("streetName").GetString());
    }

    private static JsonElement Parse(string json)
    {
        using var doc = JsonDocument.Parse(json);
        return doc.RootElement.Clone();
    }

    private static void Seed(CaseStudyDbContext db, bool accepted = false, bool reviewApproved = false)
    {
        var now = DateTime.UtcNow;
        db.Transactions.Add(new Transaction
        {
            Id = TransactionId,
            ReviewApprovedAtUtc = reviewApproved ? now : null,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        });
        db.WorkOrderProperties.Add(new WorkOrderProperty
        {
            Id = PropertyId,
            WorkOrderId = Guid.NewGuid(),
            TransactionId = TransactionId,
            DeedNumber = "DEED-701",
            Classification = PropertyTypeCatalog.SingleBuilding,
            PropertyType = "فيلا",
            InspectedPropertyType = "فيلا",
            InspectedUsage = "سكني",
            // Registered title: no survey either way, so the type change alone is under test.
            RealEstateRegNumber = "REG-701",
        });
        db.WorkflowTasks.Add(WorkflowTask.Create(
            WorkflowTaskKind.FieldInspection,
            "PO-701",
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
            PoNumber = "PO-701",
            PayloadJson = VillaPayload,
            SubmittedAtUtc = now,
            AcceptedAtUtc = accepted ? now : null,
            AcceptedByUserId = accepted ? "coordinator-1" : null,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        });
        db.SaveChanges();
    }

    private static TestBoundedContexts.Bundle CreateDb() =>
        TestBoundedContexts.Create($"inspected-type-staff-{Guid.NewGuid():N}");

    private static PartyTaskSubmissionService CreateService(
        TestBoundedContexts.Bundle bundle,
        RecordingAuditLogAppend? audit = null)
    {
        var db = bundle.CaseStudy;
        var (notifications, recipients) = TestInspectorFeeServiceFactory.CreateNotificationDeps(db);
        return new(
            new PartyTaskSubmissionRepository(db),
            new PartyTaskFailureGate(new FailureLookup(bundle.Failures)),
            TestInspectorFeeServiceFactory.CreateWorkflow(db),
            new FieldInspectionAttachmentVerifier(TestInspectorFeeServiceFactory.ShareAttachmentLookup(db)),
            TestInspectorFeeServiceFactory.CreateTimeline(db),
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
        public Task<PermissionsDto?> GetForUserIdAsync(string userId, CancellationToken cancellationToken = default) =>
            Task.FromResult<PermissionsDto?>(null);
    }
}
