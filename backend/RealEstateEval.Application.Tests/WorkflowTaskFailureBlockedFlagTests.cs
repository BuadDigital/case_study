using RealEstateEval.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.CaseStudy.Infrastructure.Persistence;
using RealEstateEval.Failures.Domain;
using RealEstateEval.Failures.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

public class WorkflowTaskFailureBlockedFlagTests
{
    private const string PoNumber = "PO-FLAG-1";
    private static readonly Guid BlockedProperty = Guid.NewGuid();
    private static readonly Guid CleanProperty = Guid.NewGuid();

    [Theory]
    [InlineData(PropertyFailureStatus.Internal, true)]
    [InlineData(PropertyFailureStatus.Review, true)]
    [InlineData(PropertyFailureStatus.Returned, true)]
    [InlineData(PropertyFailureStatus.Approved, true)]
    [InlineData(PropertyFailureStatus.Resolved, false)]
    [InlineData(PropertyFailureStatus.Suspended, false)]
    public async Task List_marks_tasks_of_a_property_with_an_unresolved_failure(
        string failureStatus,
        bool expected)
    {
        var bundle = TestBoundedContexts.Create($"task-failure-flag-{Guid.NewGuid():N}");
        var now = DateTime.UtcNow;
        bundle.CaseStudy.WorkflowTasks.Add(Task(BlockedProperty, now));
        bundle.CaseStudy.WorkflowTasks.Add(Task(CleanProperty, now));
        bundle.Failures.PropertyFailures.Add(PropertyFailure.Reconstitute(
            Guid.NewGuid(), PoNumber, BlockedProperty, "DEED-1", "عدم معرفة حدود العقار",
            "unknown-boundaries", "internal", "النظام", "", "", failureStatus, "specialist",
            now, now));
        await bundle.CaseStudy.SaveChangesAsync();
        await bundle.Failures.SaveChangesAsync();

        var query = new WorkflowTaskQueryService(
            bundle.CaseStudy, null, new FailureLookup(bundle.Failures));
        var rows = await query.ListAsync(
            WorkflowTaskListQuery.Empty,
            new PermissionsDto { PrototypeRole = "case-specialist", UserId = "u1" });

        Assert.Equal(expected, rows.Single(r => r.PropertyId == BlockedProperty.ToString())
            .PropertyFailureBlocked);
        Assert.False(rows.Single(r => r.PropertyId == CleanProperty.ToString())
            .PropertyFailureBlocked);
    }

    private static WorkflowTask Task(Guid propertyId, DateTime now) =>
        WorkflowTask.Create(
            WorkflowTaskKind.CaseStudyProperty,
            PoNumber,
            now,
            phase: WorkflowTaskPhase.Bourse,
            status: WorkflowTaskStatus.Open,
            id: Guid.NewGuid(),
            propertyId: propertyId);
}
