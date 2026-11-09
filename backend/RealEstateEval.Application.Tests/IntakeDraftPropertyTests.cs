using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Services;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Domain;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// No client-side property ids. Opening an empty slot creates the property
/// as a draft on the server and links the slot to it, so every upload carries the real id.
/// </summary>
public class IntakeDraftPropertyTests
{
    private const string Po = "PO-DRAFT-1";

    private static (TestBoundedContexts.Bundle Bundle, WorkOrder Order, WorkflowTask Slot) Seed()
    {
        var bundle = TestBoundedContexts.Create($"intake-draft-{Guid.NewGuid():N}");
        var db = bundle.CaseStudy;
        var now = DateTime.UtcNow;
        var order = new WorkOrder
        {
            Id = Guid.NewGuid(),
            PoNumber = Po,
            AssignmentType = AssignmentType.Execution,
            PromulgationDate = DateOnly.FromDateTime(now),
            ReceivedFromEnfathAt = DateOnly.FromDateTime(now),
            DueDateAt = DateOnly.FromDateTime(now.AddDays(7)),
            ClientId = Guid.NewGuid(),
            ExpectedPropertyCount = 1,
            CreatedAtUtc = now,
        };
        db.WorkOrders.Add(order);
        var slot = WorkflowTask.CreateCaseStudySlot(Po, 1, "عقار 1", "{}", "تنفيذ", now);
        db.WorkflowTasks.Add(slot);
        db.SaveChanges();
        return (bundle, order, slot);
    }

    [Fact]
    public async Task A_draft_property_is_created_without_the_initial_data_gate_and_gets_a_real_id()
    {
        var (bundle, order, _) = Seed();
        var service = TestWorkOrderServiceFactory.Create(bundle, failures: TestBoundedContexts.CreateFailureService(bundle));

        var (gated, gateErrors) = await service.AddPropertyAsync(Po, new WorkOrderPropertyDto(), CancellationToken.None);
        Assert.Null(gated);
        Assert.NotEmpty(gateErrors!);

        var (draft, errors) = await service.AddPropertyAsync(Po, new WorkOrderPropertyDto(), CancellationToken.None, softDraft: true);

        Assert.Null(errors);
        Assert.NotNull(draft);
        var row = bundle.CaseStudy.WorkOrderProperties.Single(p => p.Id == draft!.Id);
        Assert.Equal(order.Id, row.WorkOrderId);
        Assert.Equal("", row.DeedNumber);
        Assert.False(row.BourseDataCompleted);
        // The transaction opens with the deed, but an opened slot has no number yet (ruling 2026-11-08):
        // no TMP any more, and PR only at the first full save of the initial data.
        var transaction = bundle.CaseStudy.Transactions.Single(t => t.Id == row.TransactionId);
        Assert.Null(transaction.DraftNumber);
        Assert.Null(transaction.ReferenceNumber);
        Assert.Null(row.ReferenceNumber);
    }

    // The full save of an existing slot (UpdatePropertyAsync) rewrites contacts with ExecuteDelete, which the
    // in-memory provider cannot run; the insert-on-save path below goes through the same NumberDeedAsync
    // step, and "a second save never re-draws" is covered by TransactionReferenceRulesTests.
    [Fact]
    public async Task A_full_save_of_the_initial_data_numbers_the_deed()
    {
        var (bundle, _, _) = Seed();
        var service = TestWorkOrderServiceFactory.Create(bundle, failures: TestBoundedContexts.CreateFailureService(bundle));

        var (saved, errors) = await service.AddPropertyAsync(Po, FullInitialData(), CancellationToken.None);

        Assert.Null(errors);
        Assert.StartsWith("PR-", saved!.ReferenceNumber);
        // A single deed: the property number is the deed's own.
        Assert.Equal(saved.ReferenceNumber, saved.TransactionReferenceNumber);
        var transaction = bundle.CaseStudy.Transactions.Single(t => t.Id == saved.TransactionId);
        Assert.Equal(saved.ReferenceNumber, transaction.ReferenceNumber);
        Assert.Null(transaction.ConfirmedAtUtc);
    }

    [Fact]
    public async Task A_work_order_with_a_numbered_deed_is_cancelled_not_deleted()
    {
        var (bundle, _, _) = Seed();
        var service = TestWorkOrderServiceFactory.Create(bundle, failures: TestBoundedContexts.CreateFailureService(bundle));

        var (saved, _) = await service.AddPropertyAsync(Po, FullInitialData(), CancellationToken.None);
        Assert.NotNull(saved!.ReferenceNumber);

        var (ok, error) = await service.DeleteAsync(Po, CancellationToken.None);
        Assert.False(ok);
        Assert.Equal(RealEstateEval.CaseStudy.Application.Services.WorkOrderService.NumberedWorkOrderDeleteAr, error);
        Assert.True(bundle.CaseStudy.WorkOrders.Any(w => w.PoNumber == Po));
    }

    private static WorkOrderPropertyDto FullInitialData() => new()
    {
        IdentifierType = PropertyIdentifierTypeLabels.Deed,
        DeedNumber = "987650000001",
        RequestNumber = "T-1",
        AssignmentMandateNumber = "M-1",
        AssignmentMandateDate = "2026-01-01",
        DeedDate = "2026-01-01",
        OwnerName = "Owner",
        Court = "محكمة التنفيذ",
        Circuit = "1",
        DelegationLetterFileNames = ["letter.pdf"],
        AssignmentDocFileNames = ["decree.pdf"],
        Contacts = [new PropertyContactDto { Phone = "0501234567", Role = "ضابط" }],
    };

    [Fact]
    public async Task The_slot_is_linked_to_its_draft_and_stays_in_the_enfath_phase()
    {
        var (bundle, order, slot) = Seed();
        var db = bundle.CaseStudy;
        var draft = new WorkOrderProperty { Id = Guid.NewGuid(), WorkOrderId = order.Id, DeedNumber = "" };
        db.WorkOrderProperties.Add(draft);
        db.SaveChanges();
        var workflow = TestInspectorFeeServiceFactory.CreateWorkflow(db);

        var (linked, error) = await workflow.LinkPropertyAsync(slot.Id, new LinkTaskPropertyRequest { PropertyId = draft.Id.ToString("D") });

        Assert.Null(error);
        Assert.Equal(draft.Id.ToString("D"), linked!.PropertyId);
        Assert.Equal("enfath", linked.Phase);
        var again = await workflow.LinkPropertyAsync(slot.Id, new LinkTaskPropertyRequest { PropertyId = draft.Id.ToString("D") });
        Assert.Null(again.Error);                       // a repeated open is harmless

        // A slot that already holds a property is not an empty slot.
        var other = new WorkOrderProperty { Id = Guid.NewGuid(), WorkOrderId = order.Id, DeedNumber = "D-2" };
        db.WorkOrderProperties.Add(other);
        db.SaveChanges();
        var (_, taken) = await workflow.LinkPropertyAsync(slot.Id, new LinkTaskPropertyRequest { PropertyId = other.Id.ToString("D") });
        Assert.Equal(WorkflowTaskLifecycleCommands.LinkNotAnEmptySlotAr, taken);
    }

    [Fact]
    public async Task A_property_of_another_order_cannot_be_linked()
    {
        var (bundle, _, slot) = Seed();
        var db = bundle.CaseStudy;
        var now = DateTime.UtcNow;
        var otherOrder = new WorkOrder
        {
            Id = Guid.NewGuid(), PoNumber = "PO-OTHER", AssignmentType = AssignmentType.Execution,
            PromulgationDate = DateOnly.FromDateTime(now), ReceivedFromEnfathAt = DateOnly.FromDateTime(now),
            DueDateAt = DateOnly.FromDateTime(now.AddDays(7)), ClientId = Guid.NewGuid(), CreatedAtUtc = now,
        };
        var foreign = new WorkOrderProperty { Id = Guid.NewGuid(), WorkOrderId = otherOrder.Id, DeedNumber = "" };
        db.WorkOrders.Add(otherOrder);
        db.WorkOrderProperties.Add(foreign);
        db.SaveChanges();
        var workflow = TestInspectorFeeServiceFactory.CreateWorkflow(db);

        var (result, error) = await workflow.LinkPropertyAsync(slot.Id, new LinkTaskPropertyRequest { PropertyId = foreign.Id.ToString("D") });

        Assert.Null(result);
        Assert.Equal(WorkflowTaskLifecycleCommands.LinkPropertyNotInOrderAr, error);
        Assert.Null(db.WorkflowTasks.AsNoTracking().Single(t => t.Id == slot.Id).PropertyId);
    }
}
