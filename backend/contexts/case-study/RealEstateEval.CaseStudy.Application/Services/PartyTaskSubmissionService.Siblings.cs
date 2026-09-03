using RealEstateEval.Domain;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Application.Services;

/// <summary>
/// Sibling field-inspection facts: survey and appraisal packages surface whether the
/// inspection on the same parent + property is completed / accepted.
/// </summary>
public partial class PartyTaskSubmissionService
{
    private static bool NeedsInspectionFlag(string kind) =>
        kind is WorkflowTaskKindValues.EngineeringSurvey or WorkflowTaskKindValues.PropertyAppraisal;

    private static bool IsCompletedFieldInspection(WorkflowTask task) =>
        task.Kind == WorkflowTaskKind.FieldInspection && task.Status == WorkflowTaskStatus.Completed;

    /// <summary>Same meaning as ToDtoAsync for flags — from pre-loaded dictionaries.</summary>
    private static void ApplyInspectionFlags(
        PartyTaskSubmissionDto dto,
        PartyTaskSubmission entity,
        IReadOnlyDictionary<Guid, (bool Completed, bool Accepted)> flagsByTask)
    {
        if (!NeedsInspectionFlag(entity.Kind)) return;

        var flags = entity.PropertyId is not null
            && flagsByTask.TryGetValue(entity.WorkflowTaskId, out var found)
                ? found
                : (Completed: false, Accepted: false);

        dto.FieldInspectionCompleted = flags.Completed;
        if (entity.Kind == WorkflowTaskKindValues.PropertyAppraisal)
            dto.FieldInspectionAccepted = flags.Accepted;
    }

    private async Task<(bool Completed, bool Accepted)> SiblingInspectionFlagsAsync(
        Guid partyTaskId,
        Guid propertyId,
        bool includeAccepted,
        CancellationToken cancellationToken)
    {
        var facts = await _repo.ListTaskFactsAsync([partyTaskId], cancellationToken);
        if (facts.Count == 0 || facts[0].ParentTaskId is not Guid parentTaskId)
            return (false, false);

        var siblings = await _repo.ListSiblingTasksAsync([parentTaskId], [propertyId], cancellationToken);
        var completedInspectionIds = siblings
            .Where(IsCompletedFieldInspection)
            .Select(t => t.Id)
            .ToList();
        if (completedInspectionIds.Count == 0)
            return (false, false);
        if (!includeAccepted)
            return (true, false);

        var accepted = await _repo.ListAcceptedSubmissionTaskIdsAsync(completedInspectionIds, cancellationToken);
        return (true, accepted.Count > 0);
    }

    private async Task<Dictionary<Guid, (bool Completed, bool Accepted)>> LoadSiblingInspectionFlagsAsync(
        IReadOnlyList<PartyTaskSubmission> entities,
        CancellationToken cancellationToken)
    {
        var flags = new Dictionary<Guid, (bool Completed, bool Accepted)>();
        var targets = entities
            .Where(e => NeedsInspectionFlag(e.Kind) && e.PropertyId is not null)
            .Select(e => (TaskId: e.WorkflowTaskId, PropertyId: e.PropertyId!.Value))
            .Distinct()
            .ToList();
        if (targets.Count == 0) return flags;

        var taskIds = targets.Select(t => t.TaskId).Distinct().ToList();
        var parentByTask = (await _repo.ListTaskFactsAsync(taskIds, cancellationToken))
            .ToDictionary(t => t.Id, t => t.ParentTaskId);

        var parentIds = parentByTask.Values
            .Where(p => p is not null)
            .Select(p => p!.Value)
            .Distinct()
            .ToList();
        if (parentIds.Count == 0) return flags;

        var propertyIds = targets.Select(t => t.PropertyId).Distinct().ToList();
        var completedInspections = (await _repo.ListSiblingTasksAsync(parentIds, propertyIds, cancellationToken))
            .Where(IsCompletedFieldInspection)
            .ToList();

        var completedByPair = completedInspections
            .GroupBy(t => (Parent: t.ParentTaskId!.Value, Property: t.PropertyId!.Value))
            .ToDictionary(g => g.Key, g => g.Select(t => t.Id).ToList());

        var inspectionIds = completedInspections.Select(t => t.Id).ToList();
        IReadOnlySet<Guid> acceptedInspectionIds = inspectionIds.Count == 0
            ? new HashSet<Guid>()
            : await _repo.ListAcceptedSubmissionTaskIdsAsync(inspectionIds, cancellationToken);

        foreach (var target in targets)
        {
            if (parentByTask.GetValueOrDefault(target.TaskId) is not Guid parent) continue;
            if (!completedByPair.TryGetValue((parent, target.PropertyId), out var siblings))
            {
                flags[target.TaskId] = (false, false);
                continue;
            }
            flags[target.TaskId] = (
                Completed: true,
                Accepted: siblings.Any(acceptedInspectionIds.Contains));
        }

        return flags;
    }
}
