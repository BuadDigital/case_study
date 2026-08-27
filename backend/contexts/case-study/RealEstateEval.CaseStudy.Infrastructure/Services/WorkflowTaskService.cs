using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Abstractions;

namespace RealEstateEval.CaseStudy.Infrastructure.Services;

/// <summary>
/// Workflow task façade. Query, distribution, phase, and slot sync live on collaborators.
/// </summary>
public class WorkflowTaskService : IWorkflowTaskService
{
    private readonly IWorkflowTaskQuery _query;
    private readonly IWorkflowTaskSlotSynchronizer _slots;
    private readonly IWorkflowTaskDistributionCommands _distribution;
    private readonly IWorkflowTaskLifecycleCommands _lifecycle;

    public WorkflowTaskService(
        IWorkflowTaskQuery query,
        IWorkflowTaskSlotSynchronizer slots,
        IWorkflowTaskDistributionCommands distribution,
        IWorkflowTaskLifecycleCommands lifecycle)
    {
        _query = query;
        _slots = slots;
        _distribution = distribution;
        _lifecycle = lifecycle;
    }

    public Task<IReadOnlyList<WorkflowTaskDto>> ListAsync(
        PermissionsDto? actor = null,
        CancellationToken cancellationToken = default) =>
        _query.ListAsync(actor, cancellationToken);

    public Task<PagedResultDto<WorkflowTaskDto>> ListPagedAsync(
        int? page,
        int? pageSize,
        PermissionsDto? actor = null,
        CancellationToken cancellationToken = default) =>
        _query.ListPagedAsync(page, pageSize, actor, cancellationToken);

    public Task<bool> IsAssignedToAsync(
        Guid id,
        string assigneeId,
        CancellationToken cancellationToken = default) =>
        _query.IsAssignedToAsync(id, assigneeId, cancellationToken);

    public Task<IReadOnlyList<WorkflowTaskDto>> SyncFromWorkOrdersAsync(
        CancellationToken cancellationToken = default) =>
        _slots.SyncFromWorkOrdersAsync(cancellationToken);

    public Task<WorkflowTaskDto?> PatchDistributionAsync(
        Guid id,
        TaskDistributionDraftDto distribution,
        CancellationToken cancellationToken = default) =>
        _distribution.PatchDistributionAsync(id, distribution, cancellationToken);

    public Task<(ConfirmTaskDistributionResponseDto? Result, IReadOnlyDictionary<string, string>? Errors)>
        ConfirmDistributionAsync(
            Guid id,
            ConfirmTaskDistributionRequest request,
            CancellationToken cancellationToken = default) =>
        _distribution.ConfirmDistributionAsync(id, request, cancellationToken);

    public Task<(WorkflowTaskDto? Result, IReadOnlyDictionary<string, string>? Errors)> RedistributePartiesAsync(
        Guid id,
        RedistributePartiesRequest request,
        string actorRole,
        string? actorName,
        CancellationToken cancellationToken = default) =>
        _distribution.RedistributePartiesAsync(id, request, actorRole, actorName, cancellationToken);

    public Task<WorkflowTaskDto?> AdvanceAfterEnfathAsync(
        Guid id,
        AdvanceTaskAfterEnfathRequest request,
        CancellationToken cancellationToken = default) =>
        _lifecycle.AdvanceAfterEnfathAsync(id, request, cancellationToken);

    public Task<WorkflowTaskDto?> AdvanceAfterBourseAsync(
        Guid id,
        AdvanceTaskAfterBourseRequest request,
        CancellationToken cancellationToken = default) =>
        _lifecycle.AdvanceAfterBourseAsync(id, request, cancellationToken);

    public Task<(WorkflowTaskDto? Result, IReadOnlyDictionary<string, string>? Errors)> RevertPhaseAsync(
        Guid id,
        RevertWorkflowTaskPhaseRequest request,
        CancellationToken cancellationToken = default) =>
        _lifecycle.RevertPhaseAsync(id, request, cancellationToken);

    public Task<WorkflowTaskDto?> PatchAsync(
        Guid id,
        PatchWorkflowTaskRequest request,
        CancellationToken cancellationToken = default) =>
        _lifecycle.PatchAsync(id, request, cancellationToken);

    public Task DeleteForPoAsync(string poNumber, CancellationToken cancellationToken = default) =>
        _lifecycle.DeleteForPoAsync(poNumber, cancellationToken);

    public Task DeleteForPropertyAsync(
        string poNumber,
        Guid propertyId,
        int expectedPropertyCount = 1,
        CancellationToken cancellationToken = default) =>
        _lifecycle.DeleteForPropertyAsync(poNumber, propertyId, expectedPropertyCount, cancellationToken);

    public Task<(bool Ok, IReadOnlyDictionary<string, string>? Errors)> DeleteCaseStudySlotAsync(
        Guid id,
        DeleteCaseStudySlotRequest request,
        CancellationToken cancellationToken = default) =>
        _lifecycle.DeleteCaseStudySlotAsync(id, request, cancellationToken);

    public Task<(WorkflowTaskDto? Result, IReadOnlyDictionary<string, string>? Errors)> ReopenCompletedAsync(
        Guid id,
        ReopenCompletedWorkflowTaskRequest request,
        string actorRole,
        string? actorName,
        CancellationToken cancellationToken = default) =>
        _lifecycle.ReopenCompletedAsync(id, request, actorRole, actorName, cancellationToken);
}
