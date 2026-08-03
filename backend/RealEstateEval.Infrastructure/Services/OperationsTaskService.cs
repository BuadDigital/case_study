using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Infrastructure.Services;

/// <summary>
/// Operations-task façade. Query, commands, and fees/notifications live on collaborators.
/// </summary>
public sealed class OperationsTaskService : IOperationsTaskService
{
    private readonly IOperationsTaskQuery _query;
    private readonly IOperationsTaskCommands _commands;

    public OperationsTaskService(
        IOperationsTaskQuery query,
        IOperationsTaskCommands commands)
    {
        _query = query;
        _commands = commands;
    }

    /// <summary>Test-friendly compose from a shared legacy + operations pair.</summary>
    public static OperationsTaskService Create(
        OperationsDbContext ops,
        ApplicationDbContext db,
        INotificationService notifications,
        IPartyFeePricingService pricing)
    {
        var query = new OperationsTaskQueryService(ops, db);
        var notifier = new OperationsTaskNotifier(ops, db, notifications);
        var visitFees = new OperationsTaskVisitFeeHelper(db, pricing);
        var commands = new OperationsTaskCommands(ops, db, query, notifier, visitFees);
        return new OperationsTaskService(query, commands);
    }

    public Task<IReadOnlyList<OperationsTaskDto>> ListAsync(
        string? assigneeId,
        string? createdBy,
        string? status,
        string actorUserId,
        string? actorAssigneeId,
        string actorRole,
        CancellationToken cancellationToken = default) =>
        _query.ListAsync(
            assigneeId,
            createdBy,
            status,
            actorUserId,
            actorAssigneeId,
            actorRole,
            cancellationToken);

    public Task<OperationsTaskDto?> GetAsync(Guid id, CancellationToken cancellationToken = default) =>
        _query.GetAsync(id, cancellationToken);

    public Task<(OperationsTaskDto? Result, string? Error)> CreateAsync(
        CreateOperationsTaskRequest request,
        string createdBy,
        string? createdByName,
        CancellationToken cancellationToken = default) =>
        _commands.CreateAsync(request, createdBy, createdByName, cancellationToken);

    public Task<(OperationsTaskDto? Result, string? Error)> PatchAsync(
        Guid id,
        PatchOperationsTaskRequest request,
        string actorAssigneeId,
        string? actorName,
        string actorRole,
        string actorUserId,
        CancellationToken cancellationToken = default) =>
        _commands.PatchAsync(
            id, request, actorAssigneeId, actorName, actorRole, actorUserId, cancellationToken);

    public Task<(OperationsTaskDto? Result, string? Error)> ReassignAsync(
        Guid id,
        ReassignOperationsTaskRequest request,
        string actorAssigneeId,
        string? actorName,
        string actorRole,
        CancellationToken cancellationToken = default) =>
        _commands.ReassignAsync(id, request, actorAssigneeId, actorName, actorRole, cancellationToken);

    public Task<(OperationsTaskDto? Result, string? Error)> RemindAsync(
        Guid id,
        bool auto,
        string? actorName,
        string actorRole,
        CancellationToken cancellationToken = default) =>
        _commands.RemindAsync(id, auto, actorName, actorRole, cancellationToken);

    public Task<int> ProcessDueAutoRemindersAsync(CancellationToken cancellationToken = default) =>
        _commands.ProcessDueAutoRemindersAsync(cancellationToken);

    public Task<int> ProcessOverLimitPauseRemindersAsync(CancellationToken cancellationToken = default) =>
        _commands.ProcessOverLimitPauseRemindersAsync(cancellationToken);

    public Task<(OperationsTaskDto? Result, string? Error)> AddCommentAsync(
        Guid id,
        AddOperationsTaskCommentRequest request,
        string actorAssigneeId,
        string actorRole,
        string? actorName,
        CancellationToken cancellationToken = default) =>
        _commands.AddCommentAsync(id, request, actorAssigneeId, actorRole, actorName, cancellationToken);

    public Task<IReadOnlyList<CourtVisitFeeReportRowDto>> ListCourtVisitFeesAsync(
        string? creditAssigneeId = null,
        CancellationToken cancellationToken = default) =>
        _query.ListCourtVisitFeesAsync(creditAssigneeId, cancellationToken);
}
