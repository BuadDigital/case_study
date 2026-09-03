using RealEstateEval.Operations.Application.Rules;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Operations.Application.Abstractions;
using RealEstateEval.Operations.Infrastructure.Data.Contexts;
using RealEstateEval.Operations.Application.Contracts;

namespace RealEstateEval.Operations.Infrastructure.Services;

/// <summary>
/// Operations-task façade. Query, commands, and fees/notifications live on collaborators.
/// </summary>
public sealed class OperationsTaskService : IOperationsTaskService
{
    private readonly IOperationsTaskQuery _query;
    private readonly IOperationsTaskCommands _commands;
    private readonly OperationsTaskVisitFeeHelper _visitFees;

    public OperationsTaskService(
        IOperationsTaskQuery query,
        IOperationsTaskCommands commands,
        OperationsTaskVisitFeeHelper visitFees)
    {
        _query = query;
        _commands = commands;
        _visitFees = visitFees;
    }

    public OperationsTaskService(
        IOperationsTaskQuery query,
        IOperationsTaskCommands commands)
        : this(query, commands, visitFees: null!)
    {
    }

 /// <summary>Test-friendly compose from shared bounded-context pair. A8: takes the Identity
 /// abstractions instead of the Identity context type.</summary>
    public static OperationsTaskService Create(
        OperationsDbContext ops,
        ICourtVisitFeeChargeService charges,
        IIdentityDirectory identityDirectory,
        IUserLabelLookup labels,
        INotificationService notifications,
        IPartyFeePricingService pricing,
        TimeProvider? time = null)
    {
        var clock = time ?? TimeProvider.System;
        var query = new OperationsTaskQueryService(ops, charges, labels);
        var notifier = new OperationsTaskNotifier(ops, identityDirectory, notifications, labels, clock);
        var visitFees = new OperationsTaskVisitFeeHelper(
            ops, charges, identityDirectory, pricing, clock);
        var commands = new OperationsTaskCommands(ops, query, notifier, visitFees, clock);
        return new OperationsTaskService(query, commands, visitFees);
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

    public Task<int> BackfillMissingCourtVisitChargesAsync(CancellationToken cancellationToken = default)
    {
        if (_visitFees is null)
            throw new InvalidOperationException("Court-visit fee backfill requires OperationsTaskVisitFeeHelper.");
        return _visitFees.BackfillMissingChargesForCompletedVisitsAsync(cancellationToken);
    }

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

