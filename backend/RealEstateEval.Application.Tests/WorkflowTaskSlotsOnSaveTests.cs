using RealEstateEval.Application.Contracts;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Domain;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// The work order's task slots follow its deeds when the work order is SAVED (2026-11-19). They used to
/// wait for the browser's whole-table sync, which it sent on every read of the work orders; nothing here
/// calls that sync.
/// </summary>
public class WorkflowTaskSlotsOnSaveTests
{
    private const string Po = "PO-SLOTS-1";

    [Fact]
    public async Task Adding_a_deed_makes_the_missing_slots_and_links_the_deed_to_one()
    {
        var bundle = Seed(expectedCount: 2);
        var service = TestWorkOrderServiceFactory.Create(bundle, failures: TestBoundedContexts.CreateFailureService(bundle));

        var (saved, errors) = await service.AddPropertyAsync(Po, FullInitialData(), CancellationToken.None);

        Assert.Null(errors);
        var slots = Slots(bundle);
        Assert.Equal([1, 2], slots.Select(t => t.PropertyOrdinal).ToArray());
        var linked = Assert.Single(slots, t => t.PropertyId is not null);
        Assert.Equal(saved!.Id, linked.PropertyId);
        Assert.NotEqual(WorkflowTaskPhase.Enfath, linked.Phase);
    }

    [Fact]
    public async Task Deleting_a_deed_gives_its_slot_back()
    {
        var bundle = Seed(expectedCount: 2);
        var service = TestWorkOrderServiceFactory.Create(bundle, failures: TestBoundedContexts.CreateFailureService(bundle));
        var (saved, _) = await service.AddPropertyAsync(Po, FullInitialData(), CancellationToken.None);

        var (ok, error) = await service.DeletePropertyAsync(Po, saved!.Id!.Value, "خطأ في الإدخال", CancellationToken.None);

        Assert.True(ok, error);
        var slots = Slots(bundle);
        Assert.Equal(2, slots.Count);
        Assert.All(slots, t => Assert.Null(t.PropertyId));
    }

    private static List<WorkflowTask> Slots(TestBoundedContexts.Bundle bundle)
    {
        bundle.CaseStudy.ChangeTracker.Clear();
        return bundle.CaseStudy.WorkflowTasks
            .Where(t => t.PoNumber == Po && t.Kind == WorkflowTaskKind.CaseStudyProperty)
            .OrderBy(t => t.PropertyOrdinal)
            .ToList();
    }

    private static TestBoundedContexts.Bundle Seed(int expectedCount)
    {
        var bundle = TestBoundedContexts.Create($"slots-on-save-{Guid.NewGuid():N}");
        var now = DateTime.UtcNow;
        bundle.CaseStudy.WorkOrders.Add(new WorkOrder
        {
            Id = Guid.NewGuid(),
            PoNumber = Po,
            AssignmentType = AssignmentType.Execution,
            PromulgationDate = DateOnly.FromDateTime(now),
            ReceivedFromEnfathAt = DateOnly.FromDateTime(now),
            DueDateAt = DateOnly.FromDateTime(now.AddDays(7)),
            ClientId = Guid.NewGuid(),
            ExpectedPropertyCount = expectedCount,
            CreatedAtUtc = now,
        });
        bundle.CaseStudy.SaveChanges();
        return bundle;
    }

    private static WorkOrderPropertyDto FullInitialData() => new()
    {
        IdentifierType = PropertyIdentifierTypeLabels.Deed,
        DeedNumber = "987650000002",
        RequestNumber = "T-2",
        AssignmentMandateNumber = "M-2",
        AssignmentMandateDate = "2026-01-01",
        DeedDate = "2026-01-01",
        OwnerName = "Owner",
        Court = "محكمة التنفيذ",
        Circuit = "1",
        DelegationLetterFileNames = ["letter.pdf"],
        AssignmentDocFileNames = ["decree.pdf"],
        Contacts = [new PropertyContactDto { Phone = "0501234567", Role = "ضابط" }],
    };
}
