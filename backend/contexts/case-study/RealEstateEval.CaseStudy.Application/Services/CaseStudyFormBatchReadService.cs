using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Application.Services;

/// <summary>
/// Batch read behind <c>GET /api/case-study-forms/batch</c>. Two set reads replace the
/// 1 + N single-item GETs the active queue used to issue per row. The gate is the one
/// <see cref="CaseStudyFormService.GetAsync"/> applies (<see cref="CaseStudyFormReadRules"/>),
/// evaluated for the parent and again for every child, so a party sees its own child form
/// and the parent it hangs off — never a sibling's.
/// </summary>
public class CaseStudyFormBatchReadService : ICaseStudyFormBatchReadService
{
    public const int MaxParentTaskIds = 100;

    private readonly ICaseStudyFormBatchQuery _query;

    public CaseStudyFormBatchReadService(ICaseStudyFormBatchQuery query)
    {
        _query = query;
    }

    public async Task<CaseStudyFormBatchDto> GetForParentsAsync(
        IReadOnlyCollection<Guid> parentTaskIds,
        CaseStudyFormActor? actor = null,
        CancellationToken cancellationToken = default)
    {
        var ids = parentTaskIds.Where(id => id != Guid.Empty).Distinct().ToList();
        if (ids.Count > MaxParentTaskIds)
        {
            throw new ArgumentException(
                $"At most {MaxParentTaskIds} parent task ids per batch.",
                nameof(parentTaskIds));
        }

        var result = new CaseStudyFormBatchDto();
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
            .Where(f => !f.IsPartyForm)
            .GroupBy(f => f.TaskId)
            .ToDictionary(g => g.Key, g => g.First());
        var partyForms = forms
            .Where(f => f.IsPartyForm)
            .GroupBy(f => f.TaskId)
            .ToDictionary(g => g.Key, g => g.First());

        foreach (var parent in visibleParents)
        {
            var item = new CaseStudyFormBatchItemDto
            {
                ParentTaskId = parent.Id.ToString(),
                Parent = parentForms.TryGetValue(parent.Id, out var parentForm)
                    ? CaseStudyFormMapping.ToDto(parentForm)
                    : CaseStudyFormMapping.EmptyDto(parent),
            };
            foreach (var child in visibleChildrenByParent[parent.Id])
            {
                item.PartyFormsByChildTaskId[child.Id.ToString()] =
                    partyForms.TryGetValue(child.Id, out var partyForm)
                        ? CaseStudyFormMapping.ToDto(partyForm)
                        : CaseStudyFormMapping.EmptyDto(child);
            }
            result.ByParentTaskId[item.ParentTaskId] = item;
        }

        return result;
    }

    /// <summary>Mirrors the single-item gate: the task's own assignee plus its children's.</summary>
    private static bool CanRead(
        CaseStudyFormActor? actor,
        WorkflowTask task,
        IReadOnlyDictionary<Guid, IReadOnlyList<WorkflowTask>> childrenByParent)
    {
        if (actor is null) return true;

        var assigneeIds = new List<string?> { task.AssigneeId };
        if (childrenByParent.TryGetValue(task.Id, out var children))
            assigneeIds.AddRange(children.Select(c => c.AssigneeId));

        return CaseStudyFormReadRules.CanRead(actor, assigneeIds);
    }
}
