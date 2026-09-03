using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Domain;
using RealEstateEval.CaseStudy.Infrastructure.Data.Contexts;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Infrastructure.Persistence;

public sealed class WorkflowAssigneeLookup(CaseStudyDbContext caseStudy) : IWorkflowAssigneeLookup
{
    public Task<IReadOnlyList<string>> GetOpenAssigneeIdsForPropertyAsync(
        Guid propertyId,
        IReadOnlyCollection<WorkflowTaskKind> taskKinds,
        CancellationToken cancellationToken = default) =>
        QueryAsync(
            task => task.PropertyId == propertyId,
            taskKinds,
            cancellationToken);

    public async Task<IReadOnlyList<string>> GetOpenAssigneeIdsForPoAsync(
        string poNumber,
        IReadOnlyCollection<WorkflowTaskKind> taskKinds,
        CancellationToken cancellationToken = default)
    {
        var po = poNumber.Trim();
        if (po.Length == 0) return [];
        return await QueryAsync(
            task => task.PoNumber == po,
            taskKinds,
            cancellationToken);
    }

    private async Task<IReadOnlyList<string>> QueryAsync(
        System.Linq.Expressions.Expression<Func<WorkflowTask, bool>> scope,
        IReadOnlyCollection<WorkflowTaskKind> taskKinds,
        CancellationToken cancellationToken)
    {
        return await caseStudy.WorkflowTasks.AsNoTracking()
            .Where(scope)
            .Where(task =>
                taskKinds.Contains(task.Kind)
                && task.Status != WorkflowTaskStatus.Completed
                && task.Status != WorkflowTaskStatus.Cancelled
                && task.AssigneeId != null
                && task.AssigneeId != "")
            .Select(task => task.AssigneeId!)
            .Distinct()
            .ToListAsync(cancellationToken);
    }
}
