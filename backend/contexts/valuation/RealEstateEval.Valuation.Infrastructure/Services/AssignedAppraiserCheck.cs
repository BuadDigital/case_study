// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 1 (5b554f4e)
//  • Access  New file — IAssignedAppraiserCheck: the property's latest non-cancelled appraisal task from Case
//            Study and whether a user is its assignee (by property or by valuation request). Shared by the
//            report draft service and the valuation-work write filter.
// Round 2 (1b19bedc)
//  • CheckPropertyAsync / CheckRequestAsync return AssignedAppraiserVerdict (Assigned / NotAssigned /
//          Unverified). A remote timeout (TaskCanceledException without the caller cancelling) or another
//          failure is Unverified — an unreachable Case Study is no longer reported as «not the assigned
//          appraiser».
// ──────────────────────────────────────────────────────────────────────────────────────────────

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
        CancellationToken cancellationToken) =>
        (await ReadAppraisalTaskAsync(propertyId, cancellationToken)).Task;

    /// <summary>
    /// The latest non-cancelled appraisal task, and whether Case Study answered at all. A timeout of
    /// the remote client (TaskCanceledException without the caller cancelling) counts as unreachable.
    /// </summary>
    private async Task<(CaseStudyWorkflowTaskSnapshotDto? Task, bool Reached)> ReadAppraisalTaskAsync(
        Guid propertyId,
        CancellationToken cancellationToken)
    {
        try
        {
            var tasks = await caseStudy.ListWorkflowTasksByPropertyAsync(
                propertyId, [WorkflowTaskKind.PropertyAppraisal], cancellationToken);
            var task = tasks
                .Where(t => !string.Equals(t.Status, WorkflowTaskStatusValues.Cancelled, StringComparison.OrdinalIgnoreCase))
                .OrderByDescending(t => t.UpdatedAtUtc)
                .FirstOrDefault();
            return (task, true);
        }
        catch (Exception ex) when (ex is not OperationCanceledException || !cancellationToken.IsCancellationRequested)
        {
            return (null, false);
        }
    }

    public async Task<bool> IsAssignedToPropertyAsync(
        Guid propertyId,
        string userId,
        string? distributionAssigneeId,
        CancellationToken cancellationToken) =>
        await CheckPropertyAsync(propertyId, userId, distributionAssigneeId, cancellationToken)
            == AssignedAppraiserVerdict.Assigned;

    public async Task<bool> IsAssignedToRequestAsync(
        Guid valuationRequestId,
        string userId,
        string? distributionAssigneeId,
        CancellationToken cancellationToken) =>
        await CheckRequestAsync(valuationRequestId, userId, distributionAssigneeId, cancellationToken)
            == AssignedAppraiserVerdict.Assigned;

    public async Task<AssignedAppraiserVerdict> CheckPropertyAsync(
        Guid propertyId,
        string userId,
        string? distributionAssigneeId,
        CancellationToken cancellationToken)
    {
        var (task, reached) = await ReadAppraisalTaskAsync(propertyId, cancellationToken);
        if (!reached) return AssignedAppraiserVerdict.Unverified;
        return task is not null
               && PoRoleMatrixRules.IsAssignedPartyUser(task.AssigneeId, userId, distributionAssigneeId)
            ? AssignedAppraiserVerdict.Assigned
            : AssignedAppraiserVerdict.NotAssigned;
    }

    public async Task<AssignedAppraiserVerdict> CheckRequestAsync(
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
            ? await CheckPropertyAsync(id, userId, distributionAssigneeId, cancellationToken)
            : AssignedAppraiserVerdict.NotAssigned;
    }
}
