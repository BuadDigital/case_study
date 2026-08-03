using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Infrastructure.Services;

/// <summary>Removes party submissions, fee ledgers, and inspection workspaces for workflow tasks.</summary>
public sealed class WorkflowTaskCascadeCleanup
{
    private readonly ApplicationDbContext _db;
    private readonly IInspectorFeeService _inspectorFees;

    public WorkflowTaskCascadeCleanup(
        ApplicationDbContext db,
        IInspectorFeeService inspectorFees)
    {
        _db = db;
        _inspectorFees = inspectorFees;
    }

    public async Task RemovePartySubmissionsForTasksAsync(
        IReadOnlyList<Guid> taskIds,
        CancellationToken cancellationToken)
    {
        if (taskIds.Count == 0) return;
        await _inspectorFees.DeleteForWorkflowTaskIdsAsync(taskIds, cancellationToken);
        await _db.FieldInspectionWorkspaces
            .Where(w => taskIds.Contains(w.WorkflowTaskId))
            .ExecuteDeleteAsync(cancellationToken);
        var subs = await _db.PartyTaskSubmissions
            .Where(s => taskIds.Contains(s.WorkflowTaskId))
            .ToListAsync(cancellationToken);
        if (subs.Count > 0)
            _db.PartyTaskSubmissions.RemoveRange(subs);
    }
}
