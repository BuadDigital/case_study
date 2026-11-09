using RealEstateEval.Operations.Application.Rules;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Operations.Application.Abstractions;
using RealEstateEval.Operations.Application.Services;
using RealEstateEval.Operations.Infrastructure.Persistence;
using RealEstateEval.Operations.Infrastructure.Data.Contexts;
using RealEstateEval.Operations.Application.Contracts;
using RealEstateEval.Application.Rules;

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

 /// <summary>Test-friendly compose from shared bounded-context pair.: takes the Identity
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
        var notifier = new OperationsTaskNotifier(identityDirectory, notifications, labels, clock);
        var visitFees = new OperationsTaskVisitFeeHelper(
            ops, charges, identityDirectory, pricing, clock);
        var commands = new OperationsTaskCommands(
            new OperationsTaskRepository(ops), query, notifier, visitFees, clock);
        return new OperationsTaskService(query, commands, visitFees);
    }

    public Task<IReadOnlyList<OperationsTaskDto>> ListAsync(
        string? assigneeId,
        string? createdBy,
        string? status,
        string actorUserId,
        string? actorAssigneeId,
        StaffActor actorStaff,
        CancellationToken cancellationToken = default) =>
        _query.ListAsync(
            assigneeId,
            createdBy,
            status,
            actorUserId,
            actorAssigneeId,
            actorStaff,
            cancellationToken);

    public Task<IReadOnlyList<OperationsTaskDto>> ListAsync(
        OperationsTaskListQuery query,
        string actorUserId,
        string? actorAssigneeId,
        StaffActor actorStaff,
        CancellationToken cancellationToken = default) =>
        _query.ListAsync(query, actorUserId, actorAssigneeId, actorStaff, cancellationToken);

    public Task<PagedResultDto<OperationsTaskDto>> ListPagedAsync(
        OperationsTaskListQuery query,
        string actorUserId,
        string? actorAssigneeId,
        StaffActor actorStaff,
        CancellationToken cancellationToken = default) =>
        _query.ListPagedAsync(query, actorUserId, actorAssigneeId, actorStaff, cancellationToken);

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
        StaffActor actorStaff,
        string actorUserId,
        CancellationToken cancellationToken = default) =>
        _commands.PatchAsync(
            id, request, actorAssigneeId, actorName, actorStaff, actorUserId, cancellationToken);

    public Task<(OperationsTaskDto? Result, string? Error)> AcceptOutputsAsync(
        Guid id,
        string actorUserId,
        string? actorName,
        StaffActor actorStaff,
        CancellationToken cancellationToken = default) =>
        _commands.AcceptOutputsAsync(id, actorUserId, actorName, actorStaff, cancellationToken);

    public Task<(OperationsTaskDto? Result, string? Error)> ReassignAsync(
        Guid id,
        ReassignOperationsTaskRequest request,
        string actorAssigneeId,
        string? actorName,
        StaffActor actorStaff,
        CancellationToken cancellationToken = default) =>
        _commands.ReassignAsync(id, request, actorAssigneeId, actorName, actorStaff, cancellationToken);

    public Task<(OperationsTaskDto? Result, string? Error)> RemindAsync(
        Guid id,
        bool auto,
        string? actorName,
        StaffActor actorStaff,
        CancellationToken cancellationToken = default) =>
        _commands.RemindAsync(id, auto, actorName, actorStaff, cancellationToken);

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
        StaffActor actorStaff,
        string? actorName,
        CancellationToken cancellationToken = default) =>
        _commands.AddCommentAsync(id, request, actorAssigneeId, actorStaff, actorName, cancellationToken);

    public Task<IReadOnlyList<CourtVisitFeeReportRowDto>> ListCourtVisitFeesAsync(
        string? creditAssigneeId = null,
        CancellationToken cancellationToken = default) =>
        _query.ListCourtVisitFeesAsync(creditAssigneeId, cancellationToken);
}

