using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.CaseStudy.Infrastructure.Persistence;
using RealEstateEval.Domain;
using RealEstateEval.Valuation.Domain;
using RealEstateEval.Valuation.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// Only the appraiser assigned to the property writes its valuation — the capability policy alone
/// let any appraiser rewrite a colleague's comparables, cost and reconciliation.
/// </summary>
public class AssignedAppraiserCheckTests
{
    private const string AssignedDistributionId = "val-assigned";

    [Fact]
    public async Task The_assigned_appraiser_may_write_by_distribution_id_or_user_id()
    {
        var (check, requestId, _) = Arrange(AssignedDistributionId);

        Assert.True(await check.IsAssignedToRequestAsync(requestId, "u-any", AssignedDistributionId, default));

        var (byUserId, userRequestId, _) = Arrange("u-assigned");
        Assert.True(await byUserId.IsAssignedToRequestAsync(userRequestId, "u-assigned", null, default));
    }

    [Theory]
    [InlineData("u-colleague", "val-colleague")]
    [InlineData("u-colleague", null)]
    public async Task A_colleague_appraiser_may_not(string userId, string? distributionId)
    {
        var (check, requestId, _) = Arrange(AssignedDistributionId);

        Assert.False(await check.IsAssignedToRequestAsync(requestId, userId, distributionId, default));
    }

    [Fact]
    public async Task An_unknown_request_or_a_cancelled_task_refuses()
    {
        var (check, _, propertyId) = Arrange(AssignedDistributionId, cancelled: true);

        Assert.False(await check.IsAssignedToRequestAsync(Guid.NewGuid(), "u-any", AssignedDistributionId, default));
        Assert.False(await check.IsAssignedToPropertyAsync(propertyId, "u-any", AssignedDistributionId, default));
    }

    private static (AssignedAppraiserCheck Check, Guid RequestId, Guid PropertyId) Arrange(
        string assigneeId,
        bool cancelled = false)
    {
        var contexts = TestDatabases.Create("assigned-appraiser");
        var propertyId = Guid.NewGuid();
        var requestId = Guid.NewGuid();
        contexts.Valuation.ValuationRequests.Add(ValuationRequest.Create(
            requestId, "VR-A1", propertyId, "جدة", "فيلا", "مقيم", "2026-06-25", DateTime.UtcNow));
        contexts.Valuation.SaveChanges();

        var task = WorkflowTask.Create(
            WorkflowTaskKind.PropertyAppraisal, "PO-A", DateTime.UtcNow, title: "تقييم",
            phase: WorkflowTaskPhase.Done, id: Guid.NewGuid(), propertyId: propertyId,
            assigneeId: assigneeId);
        if (cancelled) task.Cancel(DateTime.UtcNow);
        contexts.CaseStudy.WorkflowTasks.Add(task);
        contexts.CaseStudy.SaveChanges();

        return (new AssignedAppraiserCheck(contexts.Valuation, new CaseStudyLookup(contexts.CaseStudy)), requestId, propertyId);
    }
}
