using RealEstateEval.Domain;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Application.Services;

public partial class PartyTaskSubmissionService
{
    private async Task<bool> CanReadTaskAsync(
        Guid taskId,
        PartySubmissionActor actor,
        CancellationToken cancellationToken)
    {
        if (PoRoleMatrixRules.CanManagePartySubmissions(actor.PrototypeRole)) return true;

        var facts = await _repo.ListTaskFactsAsync([taskId], cancellationToken);
        if (facts.Count == 0) return false;
        var task = facts[0];

        if (PoRoleMatrixRules.CanReadPartyTask(
            actor.PrototypeRole,
            task.AssigneeId,
            actor.UserId,
            actor.DistributionAssigneeId))
            return true;

        // Appraisers / EO need completed sibling field-inspection facts for report & gates
        // even though party visibility hides the inspection row from their task list.
        return await CanReadCompletedSiblingFieldInspectionAsync(task, actor, cancellationToken);
    }

    private async Task<List<Guid>> ReadableTaskIdsAsync(
        IReadOnlyList<Guid> taskIds,
        PartySubmissionActor actor,
        CancellationToken cancellationToken)
    {
        var tasks = await _repo.ListTaskFactsAsync(taskIds, cancellationToken);

        // Batch sibling check — one query for every candidate instead of one per task.
        var actorIds = ActorIdsOf(actor);
        var siblingCandidates = tasks
            .Where(t => IsCompletedFieldInspection(t) && t.PropertyId != null && t.ParentTaskId != null)
            .ToList();
        var siblingReadable = new HashSet<Guid>();
        if (siblingCandidates.Count > 0 && actorIds.Count > 0)
        {
            var parentIds = siblingCandidates.Select(t => t.ParentTaskId!.Value).Distinct().ToList();
            var propertyIds = siblingCandidates.Select(t => t.PropertyId!.Value).Distinct().ToList();
            var pairSet = (await _repo.ListSiblingTasksAsync(parentIds, propertyIds, cancellationToken))
                .Where(t => IsPartyAssignedTo(t, actorIds))
                .Select(t => (t.ParentTaskId!.Value, t.PropertyId!.Value))
                .ToHashSet();
            foreach (var candidate in siblingCandidates)
            {
                if (pairSet.Contains((candidate.ParentTaskId!.Value, candidate.PropertyId!.Value)))
                    siblingReadable.Add(candidate.Id);
            }
        }

        var readable = new List<Guid>(tasks.Count);
        foreach (var task in tasks)
        {
            if (PoRoleMatrixRules.CanReadPartyTask(
                actor.PrototypeRole,
                task.AssigneeId,
                actor.UserId,
                actor.DistributionAssigneeId)
                || siblingReadable.Contains(task.Id))
            {
                readable.Add(task.Id);
            }
        }

        return readable;
    }

    /// <summary>
    /// Property-appraisal / engineering-survey assignees on the same parent+property may
    /// read a completed field-inspection submission (party lists hide that sibling row).
    /// </summary>
    private async Task<bool> CanReadCompletedSiblingFieldInspectionAsync(
        PartyTaskFacts task,
        PartySubmissionActor actor,
        CancellationToken cancellationToken)
    {
        if (!IsCompletedFieldInspection(task)
            || task.PropertyId is not Guid propertyId
            || task.ParentTaskId is not Guid parentTaskId)
            return false;

        var actorIds = ActorIdsOf(actor);
        if (actorIds.Count == 0) return false;

        var siblings = await _repo.ListSiblingTasksAsync([parentTaskId], [propertyId], cancellationToken);
        return siblings.Any(t => IsPartyAssignedTo(t, actorIds));
    }

    private static bool IsCompletedFieldInspection(PartyTaskFacts task) =>
        task.Kind == WorkflowTaskKind.FieldInspection && task.Status == WorkflowTaskStatus.Completed;

    private static bool IsPartyAssignedTo(WorkflowTask task, HashSet<string> actorIds) =>
        task.Kind is WorkflowTaskKind.PropertyAppraisal or WorkflowTaskKind.EngineeringSurvey
        && task.AssigneeId is not null
        && actorIds.Contains(task.AssigneeId);

    private static HashSet<string> ActorIdsOf(PartySubmissionActor actor)
    {
        var actorIds = new HashSet<string>(StringComparer.Ordinal);
        if (!string.IsNullOrWhiteSpace(actor.UserId))
            actorIds.Add(actor.UserId.Trim());
        if (!string.IsNullOrWhiteSpace(actor.DistributionAssigneeId))
            actorIds.Add(actor.DistributionAssigneeId.Trim());
        return actorIds;
    }
}
