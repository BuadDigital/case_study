using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;

namespace RealEstateEval.Application.Abstractions;

/// <summary>
/// Applies party / staff visibility rules to workflow-task queries.
/// </summary>
public interface IWorkflowTaskVisibilityFilter
{
    IQueryable<WorkflowTask> OrderedTaskQuery(IQueryable<WorkflowTask> source);

    IQueryable<WorkflowTask> VisibleTaskQuery(IQueryable<WorkflowTask> source, PermissionsDto? actor);
}
