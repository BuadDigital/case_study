using RealEstateEval.Application.Contracts;
using RealEstateEval.Operations.Application.Contracts;

namespace RealEstateEval.Operations.Application.Abstractions;

public interface IOperationsTaskService
{
    Task<IReadOnlyList<OperationsTaskDto>> ListAsync(
        string? assigneeId,
        string? createdBy,
        string? status,
        string actorUserId,
        string? actorAssigneeId,
        string actorRole,
        CancellationToken cancellationToken = default);

 /// <summary>Filtered / sorted plain list. Paging members of the query are ignored here.</summary>
    Task<IReadOnlyList<OperationsTaskDto>> ListAsync(
        OperationsTaskListQuery query,
        string actorUserId,
        string? actorAssigneeId,
        string actorRole,
        CancellationToken cancellationToken = default);

 /// <summary>Filtered / sorted page. The executor-queue narrowing is applied before the count.</summary>
    Task<PagedResultDto<OperationsTaskDto>> ListPagedAsync(
        OperationsTaskListQuery query,
        string actorUserId,
        string? actorAssigneeId,
        string actorRole,
        CancellationToken cancellationToken = default);

    Task<OperationsTaskDto?> GetAsync(Guid id, CancellationToken cancellationToken = default);

    Task<(OperationsTaskDto? Result, string? Error)> CreateAsync(
        CreateOperationsTaskRequest request,
        string createdBy,
        string? createdByName,
        CancellationToken cancellationToken = default);

    Task<(OperationsTaskDto? Result, string? Error)> PatchAsync(
        Guid id,
        PatchOperationsTaskRequest request,
        string actorAssigneeId,
        string? actorName,
        string actorRole,
        string actorUserId,
        CancellationToken cancellationToken = default);

    Task<(OperationsTaskDto? Result, string? Error)> ReassignAsync(
        Guid id,
        ReassignOperationsTaskRequest request,
        string actorAssigneeId,
        string? actorName,
        string actorRole,
        CancellationToken cancellationToken = default);

    Task<(OperationsTaskDto? Result, string? Error)> RemindAsync(
        Guid id,
        bool auto,
        string? actorName,
        string actorRole,
        CancellationToken cancellationToken = default);

 /// <summary>Scheduler entry: auto-remind active tasks whose next work-hours checkpoint has passed.</summary>
    Task<int> ProcessDueAutoRemindersAsync(CancellationToken cancellationToken = default);

 /// <summary>Daily creator+assignee reminders for pauses past the one-workday limit.</summary>
    Task<int> ProcessOverLimitPauseRemindersAsync(CancellationToken cancellationToken = default);

 /// <summary>Idempotent court-visit fee charges for completed cooperator visits missing a stamp.</summary>
    Task<int> BackfillMissingCourtVisitChargesAsync(CancellationToken cancellationToken = default);

    Task<(OperationsTaskDto? Result, string? Error)> AddCommentAsync(
        Guid id,
        AddOperationsTaskCommentRequest request,
        string actorAssigneeId,
        string actorRole,
        string? actorName,
        CancellationToken cancellationToken = default);

 /// <summary>Visit fees generated from completed court_visit ops tasks.</summary>
    Task<IReadOnlyList<CourtVisitFeeReportRowDto>> ListCourtVisitFeesAsync(
        string? creditAssigneeId = null,
        CancellationToken cancellationToken = default);
}

