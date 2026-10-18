using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Services;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Domain;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// Decision 2026-10-18: no client-side property ids. Opening an empty slot creates the property
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
        Assert.False(string.IsNullOrWhiteSpace(row.ReferenceNumber));
    }

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
