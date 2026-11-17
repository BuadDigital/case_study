using RealEstateEval.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Domain;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// The distribution lock (Omar 2026-11-15): once a deed is distributed to the parties, the fields they
/// work from — deed / registry number and date, boundaries, map link, type and classification — cannot
/// change; administrative fields stay editable, and since 2026-11-17 the area too.
/// </summary>
public class PropertyDistributionLockTests
{
    private const string Po = "PO-LOCK-1";

    [Fact]
    public void Only_the_locked_fields_that_changed_are_refused()
    {
        var before = new WorkOrderPropertyDto
        {
            DeedNumber = "111", Area = "500", NorthBoundary = "شارع", LocationMapUrl = "https://maps/a",
            RequestNumber = "R-1", OwnerName = "أ",
        };
        var after = new WorkOrderPropertyDto
        {
            DeedNumber = "111", Area = "600", NorthBoundary = "جار", LocationMapUrl = "https://maps/a",
            RequestNumber = "R-2", OwnerName = "ب",
        };

        var errors = PropertyDistributionLockRules.Errors(before, after);

        // The area left the lock (Omar 2026-11-17); the boundary is still locked.
        Assert.Equal(["northBoundary"], errors.Keys.Order().ToArray());
        Assert.All(errors.Values, m => Assert.Equal(PropertyDistributionLockRules.LockedMessage, m));
    }

    [Fact]
    public void An_unchanged_save_passes()
    {
        var dto = new WorkOrderPropertyDto { DeedNumber = "111", Area = "500", PropertyType = "فيلا" };
        Assert.Empty(PropertyDistributionLockRules.Errors(dto, new WorkOrderPropertyDto
        {
            DeedNumber = " 111 ", Area = "500", PropertyType = "فيلا",
        }));
    }

    [Fact]
    public async Task A_distributed_deed_still_saves_a_corrected_area()
    {
        // Omar 2026-11-17: the area is corrected after the distribution too (change log, no notification).
        var (bundle, propertyId) = await SeedAsync(distributed: true);
        var service = TestWorkOrderServiceFactory.Create(bundle, failures: TestBoundedContexts.CreateFailureService(bundle));

        var (saved, errors) = await service.CompleteBourseDataAsync(Po, propertyId, Bourse(area: "750"), CancellationToken.None);

        Assert.Null(errors);
        Assert.Equal("750", saved!.Area);
    }

    [Fact]
    public async Task A_distributed_deed_refuses_a_bourse_save_that_changes_the_type()
    {
        var (bundle, propertyId) = await SeedAsync(distributed: true);
        var service = TestWorkOrderServiceFactory.Create(bundle, failures: TestBoundedContexts.CreateFailureService(bundle));
        var (saved, errors) = await service.CompleteBourseDataAsync(
            Po, propertyId, Bourse(area: "500", propertyType: "عمارة"), CancellationToken.None);

        Assert.Null(saved);
        Assert.Equal(PropertyDistributionLockRules.LockedMessage, errors!["propertyType"]);
    }

    [Fact]
    public async Task A_deed_not_yet_distributed_saves_the_new_area()
    {
        var (bundle, propertyId) = await SeedAsync(distributed: false);
        var service = TestWorkOrderServiceFactory.Create(bundle, failures: TestBoundedContexts.CreateFailureService(bundle));

        var (saved, errors) = await service.CompleteBourseDataAsync(Po, propertyId, Bourse(area: "750"), CancellationToken.None);

        Assert.Null(errors);
        Assert.Equal("750", saved!.Area);
    }

    private static async Task<(TestBoundedContexts.Bundle Bundle, Guid PropertyId)> SeedAsync(bool distributed)
    {
        var bundle = TestBoundedContexts.Create($"distribution-lock-{Guid.NewGuid():N}");
        var db = bundle.CaseStudy;
        var now = DateTime.UtcNow;
        db.WorkOrders.Add(new WorkOrder
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
        });
        await db.SaveChangesAsync();
        var service = TestWorkOrderServiceFactory.Create(bundle, failures: TestBoundedContexts.CreateFailureService(bundle));
        var (added, addErrors) = await service.AddPropertyAsync(Po, new WorkOrderPropertyDto
        {
            IdentifierType = PropertyIdentifierTypeLabels.Deed,
            DeedNumber = "987650000002",
            RequestNumber = "T-1",
            AssignmentMandateNumber = "M-1",
            AssignmentMandateDate = "2026-01-01",
            OwnerName = "Owner",
            Court = "محكمة التنفيذ",
            Circuit = "1",
            DelegationLetterFileNames = ["letter.pdf"],
            Contacts = [new PropertyContactDto { Phone = "0501234567", Role = "ضابط" }],
        }, CancellationToken.None);
        Assert.Null(addErrors);
        var propertyId = added!.Id!.Value;
        var (_, firstBourse) = await service.CompleteBourseDataAsync(Po, propertyId, Bourse(area: "500"), CancellationToken.None);
        Assert.Null(firstBourse);
        db.WorkflowTasks.Add(WorkflowTask.Create(
            WorkflowTaskKind.CaseStudyProperty, Po, now, title: "دراسة",
            phase: distributed ? WorkflowTaskPhase.CaseStudy : WorkflowTaskPhase.Distribution,
            propertyId: propertyId));
        await db.SaveChangesAsync();
        return (bundle, propertyId);
    }

    private static UpdatePropertyBourseRequest Bourse(string area, string propertyType = "فيلا") => new()
    {
        City = "الرياض",
        Region = "الرياض",
        District = "العليا",
        Classification = "سكني",
        PropertyType = propertyType,
        Area = area,
        DeedStatus = "فعال",
        BourseDeedImageFileName = "deed.pdf",
        RestrictionsPresent = "no",
        BoundariesAvailability = "no",
    };
}
