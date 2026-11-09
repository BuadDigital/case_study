using RealEstateEval.Application.Contracts;
using RealEstateEval.Operations.Application.Contracts;
using RealEstateEval.Application.Rules;

namespace RealEstateEval.Operations.Application.Abstractions;

public interface IOperationsTaskCommands
{
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
        StaffActor actorStaff,
        string actorUserId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// The creator accepts what a completed task delivered (Omar 2026-11-05); in his absence the section
    /// supervisor, the CDO or coordination (the task managers).
    /// </summary>
    Task<(OperationsTaskDto? Result, string? Error)> AcceptOutputsAsync(
        Guid id,
        string actorUserId,
        string? actorName,
        StaffActor actorStaff,
        CancellationToken cancellationToken = default);

    Task<(OperationsTaskDto? Result, string? Error)> ReassignAsync(
        Guid id,
        ReassignOperationsTaskRequest request,
        string actorAssigneeId,
        string? actorName,
        StaffActor actorStaff,
        CancellationToken cancellationToken = default);

    Task<(OperationsTaskDto? Result, string? Error)> RemindAsync(
        Guid id,
        bool auto,
        string? actorName,
        StaffActor actorStaff,
        CancellationToken cancellationToken = default);

    /// <summary>Scheduler entry: auto-remind active tasks whose next work-hours checkpoint has passed.</summary>
    Task<int> ProcessDueAutoRemindersAsync(CancellationToken cancellationToken = default);

    /// <summary>Daily creator+assignee reminders for pauses past the one-workday limit.</summary>
    Task<int> ProcessOverLimitPauseRemindersAsync(CancellationToken cancellationToken = default);

    Task<(OperationsTaskDto? Result, string? Error)> AddCommentAsync(
        Guid id,
        AddOperationsTaskCommentRequest request,
        string actorAssigneeId,
        StaffActor actorStaff,
        string? actorName,
        CancellationToken cancellationToken = default);
}
