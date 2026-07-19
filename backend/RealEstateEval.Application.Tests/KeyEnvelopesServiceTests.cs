using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

public class KeyEnvelopesServiceTests
{
    [Fact]
    public async Task CreateAsync_links_properties_and_generates_fee_for_court_scenario()
    {
        await using var db = CreateDb();
        var requestNumber = "REQ-ENV-100";
        var receiptId = await AddAttachmentAsync(db, "receipt.pdf");
        var photoId = await AddAttachmentAsync(db, "envelope.jpg");

        var workOrder = NewWorkOrder("PO-ENV-1");
        var property = NewProperty(workOrder.Id, "DEED-900", requestNumber);
        db.WorkOrders.Add(workOrder);
        db.WorkOrderProperties.Add(property);
        await db.SaveChangesAsync();

        var service = CreateService(db);
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
        Assert.True(envelope.FeeGenerated);
        Assert.Equal(350m, envelope.FeeAmountSar);
        Assert.Equal(KeyEnvelopeStatuses.Reviewer, envelope.Status);
        Assert.Single(envelope.LinkedProperties);
        Assert.Single(envelope.Assignments);
        Assert.NotEmpty(envelope.Timeline);
    }

    [Fact]
    public async Task CreateAsync_rejects_missing_attachments_for_court()
    {
        await using var db = CreateDb();
        var service = CreateService(db);

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
    public async Task CreateAsync_missing_scenario_requires_phones_and_skips_fee()
    {
        await using var db = CreateDb();
        var service = CreateService(db);

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
        Assert.False(ok!.FeeGenerated);
        Assert.Equal(0, ok.KeysCountActual);
    }

    [Fact]
    public async Task Internal_handoff_requires_assessor_confirm_before_status_change()
    {
        await using var db = CreateDb();
        var service = CreateService(db);
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
        await using var db = CreateDb();
        var service = CreateService(db);
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
        await using var db = CreateDb();
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

        var service = CreateService(db);
        var linked = await service.ListLinkedPropertiesAsync(requestNumber);

        Assert.Single(linked);
        Assert.Equal("KEEP", linked[0].DeedNumber);
    }

    [Fact]
    public async Task UpsertCourtAccess_eviction_suspends_study()
    {
        await using var db = CreateDb();
        var workOrder = NewWorkOrder("PO-ACC-1");
        var property = NewProperty(workOrder.Id, "DEED-ACC", "REQ-ACC");
        db.WorkOrders.Add(workOrder);
        db.WorkOrderProperties.Add(property);
        db.WorkflowTasks.Add(new WorkflowTask
        {
            Id = Guid.NewGuid(),
            Kind = "case-study-property",
            PoNumber = workOrder.PoNumber,
            PropertyId = property.Id,
            Status = WorkflowTaskStatus.Open,
            Phase = "study",
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow,
        });
        var attachmentId = await AddAttachmentAsync(db, "eviction.pdf");
        await db.SaveChangesAsync();

        var service = CreateService(db);
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
            db.PropertyFailures.AsNoTracking(),
            f => f.PropertyId == property.Id.ToString()
                 && f.Status == PropertyFailureStatus.Suspended);
        var blocked = await db.WorkflowTasks.AsNoTracking()
            .FirstAsync(t => t.PropertyId == property.Id && t.Kind == "case-study-property");
        Assert.Equal(WorkflowTaskStatus.Blocked, blocked.Status);
    }

    [Fact]
    public async Task GateResolver_prefers_envelope_handoff_for_key_available()
    {
        await using var db = CreateDb();
        var service = CreateService(db);
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

        var gate = await new PropertyKeyGateResolver(db).ResolveAsync(
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
    public async Task CreateAsync_writes_key_receipt_fee_charge()
    {
        await using var db = CreateDb();
        var service = CreateService(db);
        var envelope = await CreateCourtEnvelopeAsync(db, service);

        var charge = await db.KeyReceiptFeeCharges.AsNoTracking()
            .FirstOrDefaultAsync(c => c.EnvelopeId == envelope.Id);
        Assert.NotNull(charge);
        Assert.Equal(KeyReceiptFeeStatuses.Open, charge!.CollectionStatus);
        Assert.Equal(350m, charge.AmountSar);

        var (collected, collectError) = await service.MarkFeeCollectedAsync(
            envelope.Id,
            "INV-KEYS-1");
        Assert.Null(collectError);
        Assert.Equal(KeyReceiptFeeStatuses.Collected, collected!.CollectionStatus);
        Assert.Equal("INV-KEYS-1", collected.InvoiceReference);
    }

    [Fact]
    public async Task PropertyKeys_projection_marks_done_when_assignment_matched()
    {
        await using var db = CreateDb();
        var service = CreateService(db);
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

        var keys = new PropertyKeysService(db);
        var rows = await keys.ListAsync(null);
        var row = Assert.Single(
            rows,
            r => r.IdProp == property.DeedNumber || r.IdProp == property.Id.ToString());
        Assert.Equal("done", row.Status);
        Assert.True(row.Key);
    }

    private static KeyEnvelopesService CreateService(ApplicationDbContext db) =>
        new(db, new PropertyAccessHoldService(db));

    private static async Task<KeyEnvelopeDto> CreateCourtEnvelopeAsync(
        ApplicationDbContext db,
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

    private static async Task<Guid> AddAttachmentAsync(ApplicationDbContext db, string fileName)
    {
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

    private static ApplicationDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase($"key-envelopes-{Guid.NewGuid():N}")
            .Options;
        return new ApplicationDbContext(options);
    }
}
