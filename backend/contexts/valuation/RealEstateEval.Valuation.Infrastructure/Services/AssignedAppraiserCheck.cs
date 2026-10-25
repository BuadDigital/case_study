using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Valuation.Application.Abstractions;
using RealEstateEval.Valuation.Infrastructure.Data.Contexts;

namespace RealEstateEval.Valuation.Infrastructure.Services;

/// <inheritdoc />
public sealed class AssignedAppraiserCheck(ValuationDbContext db, ICaseStudyLookup caseStudy) : IAssignedAppraiserCheck
{
    public async Task<CaseStudyWorkflowTaskSnapshotDto?> FindAppraisalTaskAsync(
        Guid propertyId,
        CancellationToken cancellationToken)
    {
        try
        {
            var tasks = await caseStudy.ListWorkflowTasksByPropertyAsync(
                propertyId, [WorkflowTaskKind.PropertyAppraisal], cancellationToken);
            return tasks
                .Where(t => !string.Equals(t.Status, WorkflowTaskStatusValues.Cancelled, StringComparison.OrdinalIgnoreCase))
                .OrderByDescending(t => t.UpdatedAtUtc)
                .FirstOrDefault();
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            return null;
        }
    }

    public async Task<bool> IsAssignedToPropertyAsync(
        Guid propertyId,
        string userId,
        string? distributionAssigneeId,
        CancellationToken cancellationToken)
    {
        var task = await FindAppraisalTaskAsync(propertyId, cancellationToken);
        return task is not null
            && PoRoleMatrixRules.IsAssignedPartyUser(task.AssigneeId, userId, distributionAssigneeId);
    }

    public async Task<bool> IsAssignedToRequestAsync(
        Guid valuationRequestId,
        string userId,
        string? distributionAssigneeId,
        CancellationToken cancellationToken)
    {
        var propertyId = await db.ValuationRequests.AsNoTracking()
            .Where(x => x.Id == valuationRequestId)
            .Select(x => (Guid?)x.PropertyId)
            .FirstOrDefaultAsync(cancellationToken);
        return propertyId is { } id
            && await IsAssignedToPropertyAsync(id, userId, distributionAssigneeId, cancellationToken);
    }
}
