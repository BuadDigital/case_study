using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Application.Services;

/// <summary>
/// Batch read behind <c>GET /api/case-study-reports/batch</c>. Two set reads replace the
/// 1 + N single-item GETs the active queue used to issue per row. The gate is the one
/// <see cref="CaseStudyReportService.GetAsync"/> applies (<see cref="CaseStudyReportReadRules"/>),
/// evaluated for the parent and again for every child, so a party sees its own child form
/// and the parent it hangs off — never a sibling's.
/// </summary>
public class CaseStudyReportBatchReadService : ICaseStudyReportBatchReadService
{
    public const int MaxParentTaskIds = 100;

    private readonly ICaseStudyReportBatchQuery _query;

    public CaseStudyReportBatchReadService(ICaseStudyReportBatchQuery query)
    {
        _query = query;
    }

    public async Task<CaseStudyReportBatchDto> GetForParentsAsync(
        IReadOnlyCollection<Guid> parentTaskIds,
        CaseStudyReportActor? actor = null,
        CancellationToken cancellationToken = default)
    {
        var ids = parentTaskIds.Where(id => id != Guid.Empty).Distinct().ToList();
        if (ids.Count > MaxParentTaskIds)
        {
            throw new ArgumentException(
                $"At most {MaxParentTaskIds} parent task ids per batch.",
                nameof(parentTaskIds));
        }

        var result = new CaseStudyReportBatchDto();
        if (ids.Count == 0) return result;

        var family = await _query.ListParentFamiliesAsync(ids, cancellationToken);
        var byId = family.ToDictionary(t => t.Id);
        var childrenByParent = family
            .Where(t => t.ParentTaskId is not null)
            .GroupBy(t => t.ParentTaskId!.Value)
            .ToDictionary(g => g.Key, g => (IReadOnlyList<WorkflowTask>)g.ToList());

        // Resolve visibility first so the form read only touches rows the actor may see.
        var visibleParents = new List<WorkflowTask>();
        var visibleChildrenByParent = new Dictionary<Guid, List<WorkflowTask>>();
        foreach (var parentId in ids)
        {
            if (!byId.TryGetValue(parentId, out var parent)) continue;
            if (!CanRead(actor, parent, childrenByParent)) continue;

            visibleParents.Add(parent);
            var children = childrenByParent.TryGetValue(parentId, out var kids)
                ? kids.Where(child => CanRead(actor, child, childrenByParent)).ToList()
                : new List<WorkflowTask>();
            visibleChildrenByParent[parentId] = children;
        }

        if (visibleParents.Count == 0) return result;

        var forms = await _query.ListFormsAsync(
            visibleParents.Select(p => p.Id).ToList(),
            visibleChildrenByParent.Values.SelectMany(c => c).Select(c => c.Id).ToList(),
            cancellationToken);
        var parentForms = forms
            .Where(f => !f.IsPartyContribution)
            .GroupBy(f => f.TaskId)
            .ToDictionary(g => g.Key, g => g.First());
        var partyContributions = forms
            .Where(f => f.IsPartyContribution)
            .GroupBy(f => f.TaskId)
            .ToDictionary(g => g.Key, g => g.First());

        foreach (var parent in visibleParents)
        {
            var item = new CaseStudyReportBatchItemDto
            {
                ParentTaskId = parent.Id.ToString(),
                Parent = parentForms.TryGetValue(parent.Id, out var parentForm)
                    ? CaseStudyReportMapping.ToDto(parentForm)
                    : CaseStudyReportMapping.EmptyDto(parent),
            };
            foreach (var child in visibleChildrenByParent[parent.Id])
            {
                item.PartyContributionsByChildTaskId[child.Id.ToString()] =
                    partyContributions.TryGetValue(child.Id, out var partyContribution)
                        ? CaseStudyReportMapping.ToDto(partyContribution)
                        : CaseStudyReportMapping.EmptyDto(child);
            }
            result.ByParentTaskId[item.ParentTaskId] = item;
        }

        return result;
    }

    /// <summary>Mirrors the single-item gate: the task's own assignee plus its children's.</summary>
    private static bool CanRead(
        CaseStudyReportActor? actor,
        WorkflowTask task,
        IReadOnlyDictionary<Guid, IReadOnlyList<WorkflowTask>> childrenByParent)
    {
        if (actor is null) return true;

        var assigneeIds = new List<string?> { task.AssigneeId };
        if (childrenByParent.TryGetValue(task.Id, out var children))
            assigneeIds.AddRange(children.Select(c => c.AssigneeId));

        return CaseStudyReportReadRules.CanRead(actor, assigneeIds);
    }
}
