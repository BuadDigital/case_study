using RealEstateEval.Application.Rules;
using RealEstateEval.CaseStudy.Application.Contracts;

namespace RealEstateEval.CaseStudy.Application.Rules;

/// <summary>
/// Who may read a case-study or party form. Case staff read every form; a party reads a form
/// when assigned to the task itself or to one of its child tasks — the party workspace seeds
/// itself from the parent case-study form. Shared by the single-item and the batch reads so
/// the two can never drift.
/// </summary>
public static class CaseStudyFormReadRules
{
    /// <param name="taskAndChildAssigneeIds">Assignee ids of the task and of its children.</param>
    public static bool CanRead(
        CaseStudyFormActor actor,
        IEnumerable<string?> taskAndChildAssigneeIds)
    {
        if (PoRoleMatrixRules.CanManagePartySubmissions(actor.PrototypeRole)) return true;

        return taskAndChildAssigneeIds.Any(assigneeId => PoRoleMatrixRules.CanReadPartyTask(
            actor.PrototypeRole,
            assigneeId,
            actor.UserId,
            actor.DistributionAssigneeId));
    }
}
