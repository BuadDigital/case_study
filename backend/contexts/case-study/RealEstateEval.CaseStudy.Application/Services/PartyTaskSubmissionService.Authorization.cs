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

        // The sibling appraiser reads the inspector's package from its draft on; the sibling
        // engineering office keeps the completed-only read (party lists hide the inspection row).
        return await CanReadSiblingFieldInspectionAsync(task, actor, cancellationToken);
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
            .Where(t => IsSiblingReadableFieldInspection(t) && t.PropertyId != null && t.ParentTaskId != null)
            .ToList();
        var siblingReadable = new HashSet<Guid>();
        if (siblingCandidates.Count > 0 && actorIds.Count > 0)
        {
            var parentIds = siblingCandidates.Select(t => t.ParentTaskId!.Value).Distinct().ToList();
            var propertyIds = siblingCandidates.Select(t => t.PropertyId!.Value).Distinct().ToList();
            var siblings = (await _repo.ListSiblingTasksAsync(parentIds, propertyIds, cancellationToken))
                .Where(t => t.ParentTaskId is not null && t.PropertyId is not null)
                .ToList();
            foreach (var candidate in siblingCandidates)
            {
                if (siblings.Any(s =>
                        s.ParentTaskId == candidate.ParentTaskId
                        && s.PropertyId == candidate.PropertyId
                        && SiblingMayReadInspection(s, candidate.Status, actorIds)))
                {
                    siblingReadable.Add(candidate.Id);
                }
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
    /// Read of a field-inspection package by a SIBLING party on the same parent + property.
    /// The property-appraisal assignee reads it while the inspection is not cancelled (draft,
    /// reopened and submitted all readable — the appraiser works beside the inspector); the
    /// engineering-survey assignee reads it only once completed (the office pin seed depends on
    /// that). Writes are never granted here.
    /// </summary>
    private async Task<bool> CanReadSiblingFieldInspectionAsync(
        PartyTaskFacts task,
        PartySubmissionActor actor,
        CancellationToken cancellationToken)
    {
        if (!IsSiblingReadableFieldInspection(task)
            || task.PropertyId is not Guid propertyId
            || task.ParentTaskId is not Guid parentTaskId)
            return false;

        var actorIds = ActorIdsOf(actor);
        if (actorIds.Count == 0) return false;

        var siblings = await _repo.ListSiblingTasksAsync([parentTaskId], [propertyId], cancellationToken);
        return siblings.Any(t => SiblingMayReadInspection(t, task.Status, actorIds));
    }

    /// <summary>A field-inspection task a sibling may read in some state (anything not cancelled).</summary>
    private static bool IsSiblingReadableFieldInspection(PartyTaskFacts task) =>
        task.Kind == WorkflowTaskKind.FieldInspection && task.Status != WorkflowTaskStatus.Cancelled;

    /// <summary>
    /// The read rule by the actor's sibling kind: the appraiser assignee — any non-cancelled
    /// inspection; the engineering-office assignee — completed inspections only.
    /// </summary>
    private static bool SiblingMayReadInspection(
        WorkflowTask sibling,
        WorkflowTaskStatus inspectionStatus,
        HashSet<string> actorIds) =>
        sibling.Kind switch
        {
            WorkflowTaskKind.PropertyAppraisal =>
                IsAppraiserAssignedTo(sibling, actorIds) && inspectionStatus != WorkflowTaskStatus.Cancelled,
            WorkflowTaskKind.EngineeringSurvey =>
                IsOfficeAssignedTo(sibling, actorIds) && inspectionStatus == WorkflowTaskStatus.Completed,
            _ => false,
        };

    private static bool IsAppraiserAssignedTo(WorkflowTask task, HashSet<string> actorIds) =>
        task.Kind == WorkflowTaskKind.PropertyAppraisal
        && task.AssigneeId is not null
        && actorIds.Contains(task.AssigneeId);

    private static bool IsOfficeAssignedTo(WorkflowTask task, HashSet<string> actorIds) =>
        task.Kind == WorkflowTaskKind.EngineeringSurvey
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
