using System.Linq.Expressions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Application.Rules;

/// <summary>
/// Party / staff visibility of workflow tasks as a predicate. Pure rule: the Infrastructure
/// query applies it with <c>Where</c>; nothing here depends on EF, and no query object crosses
/// the Application boundary.
/// </summary>
public static class WorkflowTaskVisibilityRules
{
    private static readonly Expression<Func<WorkflowTask, bool>> Nothing = _ => false;
    private static readonly Expression<Func<WorkflowTask, bool>> Everything = _ => true;

    /// <summary>
    /// Staff who manage party submissions see every task. A party actor sees tasks whose
    /// assignee role matches their role and whose assignee is them (by distribution assignee
    /// id, user id, or display name). No actor, or an actor with no identity, sees nothing.
    /// </summary>
    public static Expression<Func<WorkflowTask, bool>> VisibleTo(PermissionsDto? actor)
    {
        if (actor is null)
            return Nothing;

        if (PoRoleMatrixRules.CanManagePartySubmissions(actor.PrototypeRole))
            return Everything;

        var role = actor.PrototypeRole?.Trim().ToLower() ?? "";
        var userId = actor.UserId.Trim();
        var assigneeId = actor.DistributionAssigneeId?.Trim() ?? "";
        var displayName = actor.DisplayName?.Trim() ?? "";

        if (role.Length == 0 || (userId.Length == 0 && assigneeId.Length == 0 && displayName.Length == 0))
            return Nothing;

        return task =>
            task.AssigneeRole.ToLower() == role
            && ((assigneeId.Length > 0 && task.AssigneeId == assigneeId)
                || (userId.Length > 0 && task.AssigneeId == userId)
                || (displayName.Length > 0 && task.AssigneeName == displayName));
    }
}
