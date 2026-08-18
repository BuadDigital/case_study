using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Infrastructure.Services;

/// <summary>Removes party submissions, fee ledgers, and inspection workspaces for workflow tasks.</summary>
public sealed class WorkflowTaskCascadeCleanup
{
    private readonly CaseStudyDbContext _caseStudy;
    private readonly IInspectorFeeService _inspectorFees;

    public WorkflowTaskCascadeCleanup(
        CaseStudyDbContext caseStudy,
        IInspectorFeeService inspectorFees)
    {
        _caseStudy = caseStudy;
        _inspectorFees = inspectorFees;
    }

    public async Task RemovePartySubmissionsForTasksAsync(
        IReadOnlyList<Guid> taskIds,
        CancellationToken cancellationToken)
    {
        if (taskIds.Count == 0) return;
        await _inspectorFees.DeleteForWorkflowTaskIdsAsync(taskIds, cancellationToken);
        await _caseStudy.FieldInspectionWorkspaces
            .Where(w => taskIds.Contains(w.WorkflowTaskId))
            .ExecuteDeleteAsync(cancellationToken);
        var subs = await _caseStudy.PartyTaskSubmissions
            .Where(s => taskIds.Contains(s.WorkflowTaskId))
            .ToListAsync(cancellationToken);
        if (subs.Count > 0)
            _caseStudy.PartyTaskSubmissions.RemoveRange(subs);
    }
}
