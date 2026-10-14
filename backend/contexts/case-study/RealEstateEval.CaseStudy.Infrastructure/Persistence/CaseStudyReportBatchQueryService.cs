using Microsoft.EntityFrameworkCore;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.CaseStudy.Infrastructure.Data.Contexts;

namespace RealEstateEval.CaseStudy.Infrastructure.Persistence;

/// <summary>EF adapter for <see cref="ICaseStudyReportBatchQuery"/> — three set reads, all untracked.</summary>
public sealed class CaseStudyReportBatchQueryService(CaseStudyDbContext db) : ICaseStudyReportBatchQuery
{
    public async Task<IReadOnlyList<WorkflowTask>> ListParentFamiliesAsync(
        IReadOnlyCollection<Guid> parentTaskIds,
        CancellationToken cancellationToken)
    {
        if (parentTaskIds.Count == 0) return Array.Empty<WorkflowTask>();

        var parentsAndChildren = await db.WorkflowTasks
            .AsNoTracking()
            .Where(t => parentTaskIds.Contains(t.Id)
                || (t.ParentTaskId != null && parentTaskIds.Contains(t.ParentTaskId.Value)))
            .ToListAsync(cancellationToken);

        var childIds = parentsAndChildren
            .Where(t => t.ParentTaskId is not null && parentTaskIds.Contains(t.ParentTaskId.Value))
            .Select(t => t.Id)
            .Where(id => !parentTaskIds.Contains(id))
            .ToList();
        if (childIds.Count == 0) return parentsAndChildren;

        // Grandchildren feed the children's own read gate (a task and its children).
        var grandchildren = await db.WorkflowTasks
            .AsNoTracking()
            .Where(t => t.ParentTaskId != null && childIds.Contains(t.ParentTaskId.Value))
            .ToListAsync(cancellationToken);

        var known = parentsAndChildren.Select(t => t.Id).ToHashSet();
        parentsAndChildren.AddRange(grandchildren.Where(t => known.Add(t.Id)));
        return parentsAndChildren;
    }

    public async Task<IReadOnlyList<CaseStudyReport>> ListFormsAsync(
        IReadOnlyCollection<Guid> parentTaskIds,
        IReadOnlyCollection<Guid> childTaskIds,
        CancellationToken cancellationToken)
    {
        if (parentTaskIds.Count == 0 && childTaskIds.Count == 0)
            return Array.Empty<CaseStudyReport>();

        return await db.CaseStudyReports
            .AsNoTracking()
            .Where(f => (!f.IsPartyContribution && parentTaskIds.Contains(f.TaskId))
                || (f.IsPartyContribution && childTaskIds.Contains(f.TaskId)))
            .ToListAsync(cancellationToken);
    }
}
