using RealEstateEval.CaseStudy.Application.Contracts;

namespace RealEstateEval.CaseStudy.Application.Services;

public sealed partial class WorkflowTaskLifecycleCommands
{
    /// <summary>Kind, status and phase of a task, or null when it does not exist.</summary>
    public async Task<WorkflowTaskPatchStateDto?> GetPatchStateAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        var entity = await _db.GetTaskForUpdateAsync(id, cancellationToken);
        return entity is null
            ? null
            : new WorkflowTaskPatchStateDto
            {
                Kind = entity.Kind,
                Status = entity.Status,
                Phase = entity.Phase,
            };
    }
}
