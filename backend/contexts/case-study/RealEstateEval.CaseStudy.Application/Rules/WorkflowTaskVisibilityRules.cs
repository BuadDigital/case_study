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

    /// <summary>The list scope of the «جميع العقارات» page (<c>WorkflowTaskListQuery.Scope</c>).</summary>
    public const string AllTransactionsScope = "all-transactions";

    /// <summary>
    /// What: which tasks an actor sees.
    /// How it works:
    /// - Staff who manage party submissions see every task.
    /// - An actor holding the «جميع العقارات» page sees every task when the list asks for that page's
    ///   scope. Added 2026-11-17 for the appraiser, who reads every transaction there.
    /// - A party actor otherwise sees only tasks whose assignee role matches theirs and whose assignee is
    ///   them, matched by distribution assignee id, user id or display name.
    /// Edge cases: no actor, or an actor with no identity, sees nothing. The scope never widens the
    /// appraiser's other queues; they send no scope.
    /// </summary>
    public static Expression<Func<WorkflowTask, bool>> VisibleTo(PermissionsDto? actor, string? scope = null)
    {
        if (actor is null)
            return Nothing;

        if (PoRoleMatrixRules.CanManagePartySubmissions(actor.PrototypeRole))
            return Everything;

        if (string.Equals(scope?.Trim(), AllTransactionsScope, StringComparison.OrdinalIgnoreCase)
            && actor.Pages.Contains(AllTransactionsScope, StringComparer.OrdinalIgnoreCase))
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
