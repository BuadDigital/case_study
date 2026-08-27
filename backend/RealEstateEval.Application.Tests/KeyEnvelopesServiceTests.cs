using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Services;
using RealEstateEval.Operations.Infrastructure.Services;
using RealEstateEval.Operations.Application.Contracts;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Operations.Domain;
using RealEstateEval.Failures.Domain;
using RealEstateEval.Financial.Domain;
using RealEstateEval.Attachments.Domain;

namespace RealEstateEval.Application.Tests;

public class KeyEnvelopesServiceTests
{
    [Fact]
    public async Task CreateAsync_links_properties_and_marks_entitlement_for_court_scenario()
    {
        var bundle = CreateDb();
        var db = bundle.CaseStudy;
        var requestNumber = "REQ-ENV-100";
        var receiptId = await AddAttachmentAsync(db, "receipt.pdf");
        var photoId = await AddAttachmentAsync(db, "envelope.jpg");

        var workOrder = NewWorkOrder("PO-ENV-1");
        var property = NewProperty(workOrder.Id, "DEED-900", requestNumber);
        db.WorkOrders.Add(workOrder);
        db.WorkOrderProperties.Add(property);
        await db.SaveChangesAsync();

        var service = CreateService(bundle);
        var (envelope, error) = await service.CreateAsync(
            new CreateKeyEnvelopeRequest
            {
                RequestNumber = requestNumber,
                Court = "محكمة جدة",
                Circuit = "الأولى",
                KeysCountLabeled = 3,
                KeysCountActual = 2,
                ReceiveScenario = KeyReceiveScenarios.Court,
                ReceiptAttachmentId = receiptId,
                PhotoAttachmentId = photoId,
                Assignments =
                [
                    new KeyEnvelopeAssignmentInput
                    {
                        DeedNumber = property.DeedNumber,
                        PropertyId = property.Id,
                    },
                ],
            },
            "user-1",
            "مراجع حكومي");

        Assert.Null(error);
        Assert.NotNull(envelope);
        Assert.True(envelope!.CountMismatch);
        Assert.NotNull(envelope.RevenueEntitlementAtUtc);
        Assert.Null(envelope.FeeAmountSar);
        Assert.Equal(KeyEnvelopeStatuses.Reviewer, envelope.Status);
        Assert.Single(envelope.LinkedProperties);
        Assert.Single(envelope.Assignments);
        Assert.NotEmpty(envelope.Timeline);
    }

    [Fact]
    public async Task CreateAsync_rejects_missing_attachments_for_court()
    {
        var bundle = CreateDb();
        var db = bundle.CaseStudy;
        var service = CreateService(bundle);

        var (envelope, error) = await service.CreateAsync(
            new CreateKeyEnvelopeRequest
            {
                RequestNumber = "REQ-1",
                Court = "محكمة",
                Circuit = "1",
                KeysCountLabeled = 1,
                KeysCountActual = 1,
                ReceiveScenario = KeyReceiveScenarios.Court,
                ReceiptAttachmentId = Guid.NewGuid(),
                PhotoAttachmentId = Guid.NewGuid(),
            },
            "user-1",
            "مراجع");

        Assert.Null(envelope);
        Assert.Equal("ملف خطاب الاستلام غير موجود", error);
    }

    [Fact]
    public async Task CreateAsync_missing_scenario_requires_phones_and_earns_nothing()
    {
        var bundle = CreateDb();
        var db = bundle.CaseStudy;
        var service = CreateService(bundle);

        var (bad, badError) = await service.CreateAsync(
            new CreateKeyEnvelopeRequest
            {
                RequestNumber = "REQ-B",
                Court = "محكمة",
                Circuit = "1",
                ReceiveScenario = KeyReceiveScenarios.Missing,
            },
            "u1",
            "مراجع");
        Assert.Null(bad);
        Assert.Contains("التواصل", badError);

        var (ok, error) = await service.CreateAsync(
            new CreateKeyEnvelopeRequest
            {
                RequestNumber = "REQ-B",
                Court = "محكمة",
                Circuit = "1",
                ReceiveScenario = KeyReceiveScenarios.Missing,
                ContactPhones = "0500000000",
            },
            "u1",
            "مراجع");
        Assert.Null(error);
        Assert.NotNull(ok);
 // Only the court scenario earns receipt revenue from إنفاذ.
        Assert.Null(ok!.RevenueEntitlementAtUtc);
        Assert.Equal(0, ok.KeysCountActual);
    }

    [Fact]
    public async Task Internal_handoff_requires_assessor_confirm_before_status_change()
    {
        var bundle = CreateDb();
        var db = bundle.CaseStudy;
        var service = CreateService(bundle);
        var envelope = await CreateCourtEnvelopeAsync(db, service);

        var (afterHandoff, error) = await service.CreateHandoffAsync(
            envelope.Id,
            new CreateKeyEnvelopeHandoffRequest
            {
                Kind = KeyHandoffKinds.Internal,
                FromParty = "مراجع",
                ToParty = "معاين",
            },
            "rev-1",
            "مراجع");
        Assert.Null(error);
        Assert.Equal(KeyEnvelopeStatuses.Reviewer, afterHandoff!.Status);
        Assert.Equal(KeyHandoffStatuses.PendingConfirm, afterHandoff.Handoffs[0].Status);

        var (confirmed, confirmError) = await service.ConfirmHandoffAsync(
            envelope.Id,
            afterHandoff.Handoffs[0].Id,
            "insp-1",
            "معاين");
        Assert.Null(confirmError);
        Assert.Equal(KeyEnvelopeStatuses.Assessor, confirmed!.Status);
    }

    [Fact]
    public async Task ConfirmAssignment_sets_matched()
    {
        var bundle = CreateDb();
        var db = bundle.CaseStudy;
        var service = CreateService(bundle);
        var envelope = await CreateCourtEnvelopeAsync(db, service);
        var assignmentId = envelope.Assignments[0].Id;

        var (updated, error) = await service.ConfirmAssignmentAsync(
            envelope.Id,
            assignmentId,
            new ConfirmKeyAssignmentRequest { Status = KeyAssignmentStatuses.Matched },
            "insp-1",
            "معاين");

        Assert.Null(error);
        Assert.Equal(KeyAssignmentStatuses.Matched, updated!.Assignments[0].Status);
        Assert.Equal("معاين", updated.Assignments[0].ConfirmedByName);
    }

    [Fact]
    public async Task ListLinkedPropertiesAsync_ignores_removed_properties()
    {
        var bundle = CreateDb();
        var db = bundle.CaseStudy;
        var requestNumber = "REQ-ENV-200";
        var workOrder = NewWorkOrder("PO-ENV-2");
        db.WorkOrders.Add(workOrder);
        db.WorkOrderProperties.AddRange(
            NewProperty(workOrder.Id, "KEEP", requestNumber),
            new WorkOrderProperty
            {
                Id = Guid.NewGuid(),
                WorkOrderId = workOrder.Id,
                IdentifierType = PropertyIdentifierType.Deed,
                DeedNumber = "REMOVED",
                RequestNumber = requestNumber,
                City = "الرياض",
                Classification = "سكني",
                PropertyType = "شقة",
                IsRemoved = true,
            });
        await db.SaveChangesAsync();

        var service = CreateService(bundle);
        var linked = await service.ListLinkedPropertiesAsync(requestNumber);

        Assert.Single(linked);
        Assert.Equal("KEEP", linked[0].DeedNumber);
    }

    [Fact]
    public async Task UpsertCourtAccess_eviction_suspends_study()
    {
        var bundle = CreateDb();
        var db = bundle.CaseStudy;
        var workOrder = NewWorkOrder("PO-ACC-1");
        var property = NewProperty(workOrder.Id, "DEED-ACC", "REQ-ACC");
        db.WorkOrders.Add(workOrder);
        db.WorkOrderProperties.Add(property);
        db.WorkflowTasks.Add(CaseStudyTask(workOrder.PoNumber, property.Id));
        var attachmentId = await AddAttachmentAsync(db, "eviction.pdf");
        await db.SaveChangesAsync();

        var service = CreateService(bundle);
        var (access, error) = await service.UpsertCourtAccessAsync(
            new UpsertPropertyCourtAccessRequest
            {
                PropertyId = property.Id,
                HasEvictionNotice = true,
                EvictionNoticeAttachmentId = attachmentId,
            },
            "u1",
            "مراجع");

        Assert.Null(error);
        Assert.Equal(PropertyCourtAccessStatuses.SuspendedEviction, access!.StudyHoldStatus);
        Assert.Contains(
            bundle.Failures.PropertyFailures.AsNoTracking(),
            f => f.PropertyId == property.Id.ToString()
                 && f.Status == PropertyFailureStatus.Suspended);
        var blocked = await db.WorkflowTasks.AsNoTracking()
            .FirstAsync(t => t.PropertyId == property.Id
                             && t.Kind == WorkflowTaskKind.CaseStudyProperty);
        Assert.Equal(WorkflowTaskStatus.Blocked, blocked.Status);
    }

    [Fact]
    public async Task UpsertCourtAccess_clear_eviction_releases_hold()
    {
        var bundle = CreateDb();
        var db = bundle.CaseStudy;
        var workOrder = NewWorkOrder("PO-ACC-2");
        var property = NewProperty(workOrder.Id, "DEED-ACC-2", "REQ-ACC-2");
        db.WorkOrders.Add(workOrder);
        db.WorkOrderProperties.Add(property);
        db.WorkflowTasks.Add(CaseStudyTask(workOrder.PoNumber, property.Id));
        var attachmentId = await AddAttachmentAsync(db, "eviction2.pdf");
        await db.SaveChangesAsync();

        var service = CreateService(bundle);
        var (suspended, suspendError) = await service.UpsertCourtAccessAsync(
            new UpsertPropertyCourtAccessRequest
            {
                PropertyId = property.Id,
                HasEvictionNotice = true,
                EvictionNoticeAttachmentId = attachmentId,
            },
            "u1",
            "مراجع");
        Assert.Null(suspendError);
        Assert.Equal(PropertyCourtAccessStatuses.SuspendedEviction, suspended!.StudyHoldStatus);

        var (cleared, clearError) = await service.UpsertCourtAccessAsync(
            new UpsertPropertyCourtAccessRequest
            {
                PropertyId = property.Id,
                HasEnablingLetter = false,
                HasEvictionNotice = false,
            },
            "u1",
            "مراجع");

        Assert.Null(clearError);
        Assert.Equal(PropertyCourtAccessStatuses.None, cleared!.StudyHoldStatus);
        Assert.False(cleared.HasEvictionNotice);
        Assert.Null(cleared.EvictionNoticeAttachmentId);
        Assert.Contains(
            bundle.Failures.PropertyFailures.AsNoTracking(),
            f => f.PropertyId == property.Id.ToString()
                 && f.Status == PropertyFailureStatus.Resolved);
        var resumed = await db.WorkflowTasks.AsNoTracking()
            .FirstAsync(t => t.PropertyId == property.Id
                             && t.Kind == WorkflowTaskKind.CaseStudyProperty);
        Assert.Equal(WorkflowTaskStatus.Open, resumed.Status);
        Assert.Equal(WorkflowTaskPhase.CaseStudy, resumed.Phase);
    }

    [Fact]
    public async Task GateResolver_prefers_envelope_handoff_for_key_available()
    {
        var bundle = CreateDb();
        var db = bundle.CaseStudy;
        var service = CreateService(bundle);
        var workOrder = NewWorkOrder("PO-GATE-1");
        var property = NewProperty(workOrder.Id, "DEED-GATE", "REQ-GATE");
        db.WorkOrders.Add(workOrder);
        db.WorkOrderProperties.Add(property);
        await db.SaveChangesAsync();

        var receiptId = await AddAttachmentAsync(db, "r.pdf");
        var photoId = await AddAttachmentAsync(db, "p.jpg");
        var (envelope, error) = await service.CreateAsync(
            new CreateKeyEnvelopeRequest
            {
                RequestNumber = "REQ-GATE",
                Court = "محكمة",
                Circuit = "1",
                KeysCountLabeled = 1,
                KeysCountActual = 1,
                ReceiveScenario = KeyReceiveScenarios.Court,
                ReceiptAttachmentId = receiptId,
                PhotoAttachmentId = photoId,
                Assignments =
                [
                    new KeyEnvelopeAssignmentInput
                    {
                        DeedNumber = property.DeedNumber,
                        PropertyId = property.Id,
                    },
                ],
            },
            "u1",
            "مراجع");
        Assert.Null(error);

        var (afterHandoff, handoffError) = await service.CreateHandoffAsync(
            envelope!.Id,
            new CreateKeyEnvelopeHandoffRequest
            {
                Kind = KeyHandoffKinds.Internal,
                FromParty = "مراجع",
                ToParty = "معاين",
            },
            "u1",
            "مراجع");
        Assert.Null(handoffError);

        await service.ConfirmHandoffAsync(
            envelope.Id,
            afterHandoff!.Handoffs[0].Id,
            "insp-1",
            "معاين");

        var gate = await TestBoundedContexts.CreateKeyGate(bundle).ResolveAsync(
            property.Id,
            workOrder.PoNumber,
            property.DeedNumber,
            property.RequestNumber);

        Assert.Equal("envelope", gate.Source);
        Assert.True(gate.KeyAvailable);
        Assert.Equal("yes", gate.KeyHandedToInspector);
        Assert.Equal("received", gate.KeysStatus);
    }

    [Fact]
    public async Task DeleteAsync_removes_envelope_children_and_fee_charge()
    {
        var bundle = CreateDb();
        var db = bundle.CaseStudy;
        var service = CreateService(bundle);
        var envelope = await CreateCourtEnvelopeAsync(db, service);
        await AddHistoricalChargeAsync(db, envelope.Id, envelope.RequestNumber, 275m);

        var deleted = await service.DeleteAsync(envelope.Id);

        var fin = TestInspectorFeeServiceFactory.ShareFinancial(db);
        Assert.True(deleted);
        Assert.False(await bundle.Ops.KeyEnvelopes.AnyAsync(e => e.Id == envelope.Id));
        Assert.False(await bundle.Ops.KeyEnvelopeAssignments.AnyAsync(a => a.EnvelopeId == envelope.Id));
        Assert.False(await bundle.Ops.KeyEnvelopeTimelineEntries.AnyAsync(t => t.EnvelopeId == envelope.Id));
        Assert.False(await fin.KeyReceiptFeeCharges.AnyAsync(c => c.EnvelopeId == envelope.Id));
        Assert.False(await service.DeleteAsync(envelope.Id));
    }

    [Fact]
    public async Task PropertyKeys_projection_marks_done_when_assignment_matched()
    {
        var bundle = CreateDb();
        var db = bundle.CaseStudy;
        var service = CreateService(bundle);
        var workOrder = NewWorkOrder("PO-PROJ-1");
        var property = NewProperty(workOrder.Id, "DEED-PROJ", "REQ-PROJ");
        db.WorkOrders.Add(workOrder);
        db.WorkOrderProperties.Add(property);
        await db.SaveChangesAsync();

        var receiptId = await AddAttachmentAsync(db, "r.pdf");
        var photoId = await AddAttachmentAsync(db, "p.jpg");
        var (envelope, error) = await service.CreateAsync(
            new CreateKeyEnvelopeRequest
            {
                RequestNumber = "REQ-PROJ",
                Court = "محكمة",
                Circuit = "1",
                KeysCountLabeled = 1,
                KeysCountActual = 1,
                ReceiveScenario = KeyReceiveScenarios.Court,
                ReceiptAttachmentId = receiptId,
                PhotoAttachmentId = photoId,
                Assignments =
                [
                    new KeyEnvelopeAssignmentInput
                    {
                        DeedNumber = property.DeedNumber,
                        PropertyId = property.Id,
                    },
                ],
            },
            "u1",
            "مراجع");
        Assert.Null(error);

        await service.ConfirmAssignmentAsync(
            envelope!.Id,
            envelope.Assignments[0].Id,
            new ConfirmKeyAssignmentRequest { Status = KeyAssignmentStatuses.Matched },
            "insp",
            "معاين");

        var keys = TestBoundedContexts.CreatePropertyKeys(bundle);
        var rows = await keys.ListAsync(null);
        var row = Assert.Single(
            rows,
            r => r.IdProp == property.DeedNumber || r.IdProp == property.Id.ToString());
        Assert.Equal(PropertyKeyWorkflowStatuses.Done, row.Status);
        Assert.True(row.Key);
    }

 /// <summary>
 /// Registering the envelope is what earns the receipt revenue from إنفاذ, and that is all it does.
 /// It used to stamp an amount off the government-review table — a figure the pricing screen owned
 /// but nobody had agreed to bill — and it must not be confused with the visit fee either.
 /// </summary>
    [Fact]
    public async Task CreateAsync_court_envelope_marks_entitlement_without_any_amount()
    {
        var bundle = CreateDb();
        var db = bundle.CaseStudy;
        var fin = TestInspectorFeeServiceFactory.ShareFinancial(db);
        fin.PartyFeePricingTables.Add(new PartyFeePricingTable
        {
            Id = Guid.NewGuid(),
            Name = "gov-test",
            Category = PartyFeePricingCategories.CourtVisit,
            IsActive = true,
            CourtVisitFeeSar = 400m,
            UpdatedAtUtc = DateTime.UtcNow,
        });
        await fin.SaveChangesAsync();

        var envelope = await CreateCourtEnvelopeAsync(db, CreateService(bundle));

        Assert.NotNull(envelope.RevenueEntitlementAtUtc);
        Assert.False(envelope.FeeGenerated);
        Assert.Null(envelope.FeeAmountSar);
        Assert.Empty(fin.KeyReceiptFeeCharges);
        Assert.Empty(fin.CourtVisitFeeCharges);
        Assert.Contains(
            envelope.Timeline,
            t => t.Summary.Contains("فوترة إنفاذ", StringComparison.Ordinal));
    }

 /// <summary>
 /// The report is one list: what finance already has amounts for, and what is merely owed to be
 /// billed. Reading either side alone hid the other.
 /// </summary>
    [Fact]
    public async Task The_fee_report_shows_entitlements_beside_the_historical_charges()
    {
        var bundle = CreateDb();
        var db = bundle.CaseStudy;
        var service = CreateService(bundle);
        var entitlement = await CreateCourtEnvelopeAsync(db, service);
        var historical = await CreateCourtEnvelopeAsync(db, service);
        await AddHistoricalChargeAsync(db, historical.Id, historical.RequestNumber, 275m);

        var report = await service.ListFeeReportAsync();

        Assert.Equal(2, report.Count);
        Assert.Equal(275m, Assert.Single(report, r => r.EnvelopeId == historical.Id).FeeAmountSar);
        Assert.Null(Assert.Single(report, r => r.EnvelopeId == entitlement.Id).FeeAmountSar);
    }

 /// <summary>
 /// There is nothing for finance to confirm on an entitlement — the amount is entered during
 /// enforcement billing — so the refusal has to say that rather than claim the record is missing.
 /// </summary>
    [Fact]
    public async Task Confirming_collection_on_an_entitlement_explains_it_carries_no_amount()
    {
        var bundle = CreateDb();
        var db = bundle.CaseStudy;
        var service = CreateService(bundle);
        var envelope = await CreateCourtEnvelopeAsync(db, service);

        var (row, error) = await service.MarkFeeCollectedAsync(envelope.Id, null);

        Assert.Null(row);
        Assert.Contains("فوترة إنفاذ", error);
    }

    [Fact]
    public async Task Confirming_collection_still_works_on_a_historical_charge()
    {
        var bundle = CreateDb();
        var db = bundle.CaseStudy;
        var service = CreateService(bundle);
        var envelope = await CreateCourtEnvelopeAsync(db, service);
        await AddHistoricalChargeAsync(db, envelope.Id, envelope.RequestNumber, 275m);

        var (row, error) = await service.MarkFeeCollectedAsync(envelope.Id, "INV-9");

        Assert.Null(error);
        Assert.Equal(KeyReceiptFeeStatuses.Collected, row!.CollectionStatus);
        Assert.Equal("INV-9", row.InvoiceReference);
    }

    private static KeyEnvelopesService CreateService(TestBoundedContexts.Bundle bundle) =>
        TestBoundedContexts.CreateKeyEnvelopesService(bundle);

 /// <summary>
 /// A charge from before key-receipt revenue left the pricing table. Nothing creates these any
 /// more, but they stay readable and collectable.
 /// </summary>
    private static async Task AddHistoricalChargeAsync(
        DbContext store,
        Guid envelopeId,
        string requestNumber,
        decimal amountSar)
    {
        var db = TestInspectorFeeServiceFactory.ShareFinancial(store);
        var now = DateTime.UtcNow;
        db.KeyReceiptFeeCharges.Add(new KeyReceiptFeeCharge
        {
            Id = Guid.NewGuid(),
            EnvelopeId = envelopeId,
            RequestNumber = requestNumber,
            AmountSar = amountSar,
            CollectionStatus = KeyReceiptFeeStatuses.Open,
            CreatedByUserId = "u1",
            CreatedByName = "مراجع",
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        });
        await db.SaveChangesAsync();
    }

    private static async Task<KeyEnvelopeDto> CreateCourtEnvelopeAsync(
        DbContext db,
        KeyEnvelopesService service)
    {
        var receiptId = await AddAttachmentAsync(db, "r.pdf");
        var photoId = await AddAttachmentAsync(db, "p.jpg");
        var (envelope, error) = await service.CreateAsync(
            new CreateKeyEnvelopeRequest
            {
                RequestNumber = $"REQ-{Guid.NewGuid():N}"[..8],
                Court = "محكمة",
                Circuit = "1",
                KeysCountLabeled = 1,
                KeysCountActual = 1,
                ReceiveScenario = KeyReceiveScenarios.Court,
                ReceiptAttachmentId = receiptId,
                PhotoAttachmentId = photoId,
                Assignments =
                [
                    new KeyEnvelopeAssignmentInput { DeedNumber = "D-1" },
                ],
            },
            "u1",
            "مراجع");
        Assert.Null(error);
        return envelope!;
    }

 /// <summary>A parent slot in the case-study phase — the phase a court hold suspends.</summary>
    private static WorkflowTask CaseStudyTask(string poNumber, Guid propertyId) =>
        WorkflowTask.Create(
            WorkflowTaskKind.CaseStudyProperty,
            poNumber,
            DateTime.UtcNow,
            phase: WorkflowTaskPhase.CaseStudy,
            propertyId: propertyId);

    private static WorkOrder NewWorkOrder(string po) => new()
    {
        Id = Guid.NewGuid(),
        PoNumber = po,
        AssignmentType = AssignmentType.Execution,
        PromulgationDate = DateOnly.FromDateTime(DateTime.UtcNow),
        ReceivedFromEnfathAt = DateOnly.FromDateTime(DateTime.UtcNow),
        DueDateAt = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(7)),
        CreatedAtUtc = DateTime.UtcNow,
    };

    private static WorkOrderProperty NewProperty(
        Guid workOrderId,
        string deed,
        string requestNumber) => new()
    {
        Id = Guid.NewGuid(),
        WorkOrderId = workOrderId,
        IdentifierType = PropertyIdentifierType.Deed,
        DeedNumber = deed,
        RequestNumber = requestNumber,
        City = "جدة",
        Court = "محكمة جدة",
        Circuit = "الأولى",
        Classification = "سكني",
        PropertyType = "فيلا",
    };

    private static async Task<Guid> AddAttachmentAsync(DbContext store, string fileName)
    {
        var db = TestInspectorFeeServiceFactory.ShareAttachments(store);
        var id = Guid.NewGuid();
        db.FileAttachments.Add(new FileAttachment
        {
            Id = id,
            Scope = "key-envelope-test",
            ScopeKey = "test",
            FileName = fileName,
            ContentType = "application/octet-stream",
            SizeBytes = 4,
            Content = [1, 2, 3, 4],
            UploadedByUserId = "test",
            CreatedAtUtc = DateTime.UtcNow,
        });
        await db.SaveChangesAsync();
        return id;
    }

    private static TestBoundedContexts.Bundle CreateDb() =>
        TestBoundedContexts.Create($"key-envelopes-{Guid.NewGuid():N}");
}
