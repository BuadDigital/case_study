using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;

namespace RealEstateEval.CaseStudy.Infrastructure.Persistence;

public sealed partial class WorkflowTaskQueryService
{
 /// <summary>
 /// Party child tasks name the case specialist only by assignee id in their distribution, and
 /// parties can neither see the family parent nor list staff — so their parties rail showed
 /// «لم يُعيَّن». The parent's assignee is the specialist once distribution named one: copy its
 /// display name, one query over the parent ids of the page.
 /// </summary>
    internal async Task EnrichCaseSpecialistNameAsync(
        IReadOnlyList<WorkflowTaskDto> dtos,
        CancellationToken cancellationToken)
    {
        var targets = dtos
            .Where(d =>
                d.Kind != WorkflowTaskKindValues.CaseStudyProperty
                && d.Distribution is { CaseSpecialist: true } distribution
                && !string.IsNullOrWhiteSpace(distribution.CaseSpecialistId)
                && Guid.TryParse(d.ParentTaskId, out _))
            .ToList();
        if (targets.Count == 0) return;

        var parentIds = targets.Select(t => Guid.Parse(t.ParentTaskId!)).ToHashSet();
        var parents = await _caseStudy.WorkflowTasks.AsNoTracking()
            .Where(t => parentIds.Contains(t.Id))
            .Select(t => new { t.Id, t.AssigneeId, t.AssigneeName })
            .ToDictionaryAsync(t => t.Id, cancellationToken);

        foreach (var target in targets)
        {
            if (!parents.TryGetValue(Guid.Parse(target.ParentTaskId!), out var parent)) continue;
            // The parent may sit with the supervisor (specialist not yet taken over): no name then.
            if (!string.Equals(
                    parent.AssigneeId?.Trim(),
                    target.Distribution!.CaseSpecialistId.Trim(),
                    StringComparison.Ordinal))
                continue;
            var name = parent.AssigneeName?.Trim();
            if (!string.IsNullOrEmpty(name)) target.CaseSpecialistName = name;
        }
    }
}
