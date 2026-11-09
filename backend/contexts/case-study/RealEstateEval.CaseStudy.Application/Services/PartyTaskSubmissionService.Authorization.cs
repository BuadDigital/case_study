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

        // The sibling appraiser reads the inspector's package and the office's survey only once the
        // specialist accepted them; the sibling engineering office keeps the completed-only read of
        // the inspection (party lists hide the inspection row).
        return await CanReadSiblingPackageAsync(task, actor, cancellationToken);
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
            .Where(t => IsSiblingReadablePackage(t) && t.PropertyId != null && t.ParentTaskId != null)
            .ToList();
        var siblingReadable = new HashSet<Guid>();
        if (siblingCandidates.Count > 0 && actorIds.Count > 0)
        {
            var accepted = await _repo.ListAcceptedSubmissionTaskIdsAsync(
                siblingCandidates.Select(t => t.Id).ToList(), cancellationToken);
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
                        && SiblingMayRead(s, candidate, accepted.Contains(candidate.Id), actorIds)))
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
    /// Read of a party package by a SIBLING party on the same parent + property.
    ///
    /// How it works: the field inspection — the property-appraisal assignee reads it only once the
    /// specialist accepted it (the package carries an acceptance stamp); the engineering-survey
    /// assignee reads it once completed (the office pin seed depends on that). The engineering
    /// survey — the property-appraisal assignee reads it once the specialist accepted it: the
    /// valuation report prints the office's boundaries and its survey report from that package.
    ///
    /// Edge cases: writes are never granted here. A package returned for correction loses its
    /// stamp, so the appraiser stops reading it until the specialist accepts it again. Omar's
    /// ruling 2026-11-05: every piece of the inspector's data waits for the specialist, like the
    /// boundaries — until then the appraiser read drafts and unaccepted packages too. Fixed
    /// 2026-11-04 (A→Z run): the appraiser got a 404 on the sibling survey, so his report printed
    /// the inspector's boundaries instead of the office's and left «التقرير المساحي» empty.
    /// </summary>
    private async Task<bool> CanReadSiblingPackageAsync(
        PartyTaskFacts task,
        PartySubmissionActor actor,
        CancellationToken cancellationToken)
    {
        if (!IsSiblingReadablePackage(task)
            || task.PropertyId is not Guid propertyId
            || task.ParentTaskId is not Guid parentTaskId)
            return false;

        var actorIds = ActorIdsOf(actor);
        if (actorIds.Count == 0) return false;

        var accepted = (await _repo.ListAcceptedSubmissionTaskIdsAsync([task.Id], cancellationToken))
            .Contains(task.Id);
        var siblings = await _repo.ListSiblingTasksAsync([parentTaskId], [propertyId], cancellationToken);
        return siblings.Any(t => SiblingMayRead(t, task, accepted, actorIds));
    }

    /// <summary>
    /// A package a sibling may read at all: a completed inspection or survey. The acceptance stamp
    /// the appraiser also needs is checked per reader in <see cref="SiblingMayRead"/>.
    /// </summary>
    private static bool IsSiblingReadablePackage(PartyTaskFacts task) =>
        task.Kind is WorkflowTaskKind.FieldInspection or WorkflowTaskKind.EngineeringSurvey
        && task.Status == WorkflowTaskStatus.Completed;

    /// <summary>
    /// The read rule by the package and the actor's sibling kind: an inspection — the appraiser
    /// assignee once the specialist accepted it, the engineering-office assignee once completed;
    /// a survey — the appraiser assignee once accepted.
    /// </summary>
    private static bool SiblingMayRead(
        WorkflowTask sibling,
        PartyTaskFacts package,
        bool packageAccepted,
        HashSet<string> actorIds) =>
        (package.Kind, sibling.Kind) switch
        {
            (WorkflowTaskKind.FieldInspection, WorkflowTaskKind.PropertyAppraisal) =>
                IsAppraiserAssignedTo(sibling, actorIds) && packageAccepted,
            (WorkflowTaskKind.FieldInspection, WorkflowTaskKind.EngineeringSurvey) =>
                IsOfficeAssignedTo(sibling, actorIds),
            (WorkflowTaskKind.EngineeringSurvey, WorkflowTaskKind.PropertyAppraisal) =>
                IsAppraiserAssignedTo(sibling, actorIds) && packageAccepted,
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
