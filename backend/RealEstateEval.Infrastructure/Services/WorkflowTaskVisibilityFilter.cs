using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;

namespace RealEstateEval.Infrastructure.Services;

public sealed class WorkflowTaskVisibilityFilter : IWorkflowTaskVisibilityFilter
{
    public IQueryable<WorkflowTask> OrderedTaskQuery(IQueryable<WorkflowTask> source) =>
        source
            .OrderByDescending(t => t.CreatedAtUtc)
            .ThenBy(t => t.PoNumber)
            .ThenBy(t => t.PropertyOrdinal);

    public IQueryable<WorkflowTask> VisibleTaskQuery(IQueryable<WorkflowTask> source, PermissionsDto? actor)
    {
        var query = OrderedTaskQuery(source);
        if (actor is null || PoRoleMatrixRules.CanManagePartySubmissions(actor.PrototypeRole))
            return query;

        var role = actor.PrototypeRole?.Trim().ToLower() ?? "";
        var userId = actor.UserId.Trim();
        var assigneeId = actor.DistributionAssigneeId?.Trim() ?? "";
        var displayName = actor.DisplayName?.Trim() ?? "";

        if (role.Length == 0 || (userId.Length == 0 && assigneeId.Length == 0 && displayName.Length == 0))
            return query.Where(_ => false);

        return query.Where(task =>
            task.AssigneeRole.ToLower() == role
            && ((assigneeId.Length > 0 && task.AssigneeId == assigneeId)
                || (userId.Length > 0 && task.AssigneeId == userId)
                || (displayName.Length > 0 && task.AssigneeName == displayName)));
    }
}
