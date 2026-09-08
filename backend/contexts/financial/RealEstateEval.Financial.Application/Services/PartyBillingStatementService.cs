using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Financial.Application.Abstractions;
using RealEstateEval.Financial.Application.Rules;
using RealEstateEval.Financial.Domain;

namespace RealEstateEval.Financial.Application.Services;

/// <summary>
/// Party billing statement use case: ready dues, statement create / issue / close / cancel,
/// deferral, and the monthly vendor run. Persistence is
/// <see cref="IPartyBillingStatementRepository"/>, so this class never opens EF.
/// </summary>
public partial class PartyBillingStatementService : IPartyBillingStatementService
{
    private const int MaxListRows = 500;

 /// <summary>ledger-backed party fee kinds (workflow + inspector fee ledger).</summary>
    private static readonly IReadOnlySet<WorkflowTaskKind> StatementKinds =
        PartyBillingStatementRules.StatementKinds;

 /// <summary>Ops court-visit fee charges — individual payee, same statement close path as individuals.</summary>
    public const string CourtVisitTaskKind = PartyBillingStatementRules.CourtVisitTaskKind;

    private readonly IPartyBillingStatementRepository _db;
    private readonly ICaseStudyLookup _lookup;
    private readonly IStatementAttachmentLookup _attachments;
    private readonly INotificationService _notifications;
    private readonly INotificationRecipientResolver _recipients;
    private readonly ICourtVisitFeeBackfill? _visitFees;
    private readonly ILogger<PartyBillingStatementService> _logger;
    private readonly TimeProvider _time;

    /// <remarks>
    /// The court-visit backfill is optional: hosts that cannot reach Operations at all simply
    /// skip the compensation before ready lines are listed. The Financial host does have it —
    /// its adapter goes through the operations-task client.
    /// </remarks>
    [ActivatorUtilitiesConstructor]
    public PartyBillingStatementService(
        IPartyBillingStatementRepository db,
        ICaseStudyLookup lookup,
        IStatementAttachmentLookup attachments,
        INotificationService notifications,
        INotificationRecipientResolver recipients,
        ILogger<PartyBillingStatementService> logger,
        TimeProvider? time = null,
        ICourtVisitFeeBackfill? visitFees = null)
    {
        _time = time ?? TimeProvider.System;

        _db = db;
        _lookup = lookup;
        _attachments = attachments;
        _notifications = notifications;
        _recipients = recipients;
        _visitFees = visitFees;
        _logger = logger;
    }

    public async Task<IReadOnlyList<PartyBillingReadyLineDto>> ListReadyLinesAsync(
        string? assigneeId = null,
        CancellationToken cancellationToken = default)
    {
 // Cooperator visits that completed without a charge become ready on first costs load.
        try
        {
            if (_visitFees is not null)
                await _visitFees.BackfillMissingChargesForCompletedVisitsAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Court-visit fee backfill before ready-lines failed");
        }

 // WorkflowTaskId is unique on statement lines — once billed (even paid/cancelled line),
 // twin reassignment ledgers must not reappear as dues.
 // Court-visit charges reuse the same column with charge.Id as the line key.
        var claimed = await _db.ListClaimedLineKeysAsync(cancellationToken);

 // Cross-context: materialize statement-kind task ids from Case Study, then filter Financial ledgers.
        var statementTasks = (await _lookup.ListWorkflowTasksByKindsAsync(
                [.. StatementKinds],
                cancellationToken))
            .Select(task => new { task.Id, Kind = PartyBillingRowMapper.ParseKind(task.Kind) })
            .Where(task => StatementKinds.Contains(task.Kind))
            .ToList();
        var kindByTaskId = statementTasks.ToDictionary(task => task.Id, task => task.Kind);
        var statementTaskIds = kindByTaskId.Keys.ToList();

        var ledgerRows = (await _db.ListBillableLedgersAsync(
                statementTaskIds,
                assigneeId,
                MaxListRows,
                cancellationToken))
            .Where(ledger => !claimed.Contains(ledger.WorkflowTaskId))
            .ToList();

 // Reassignment twins + multi-deed share one statement line (unique WorkflowTaskId).
 // Surface one ready row per task.
        var ledgers = PartyBillingStatementRules.PickOneLedgerPerTask(ledgerRows);
        var kindByTask = ledgers.ToDictionary(
            ledger => ledger.WorkflowTaskId,
            ledger => kindByTaskId.GetValueOrDefault(ledger.WorkflowTaskId));

        var labels = await LoadPropertyLabelsAsync(
            PartyBillingStatementRules.PropertyIdsOf(ledgers),
            cancellationToken);

        var ledgerReady = ledgers
            .OrderByDescending(l => l.UpdatedAtUtc)
            .Select(l => PartyBillingRowMapper.ToReadyDto(l, labels, kindByTask.GetValueOrDefault(l.WorkflowTaskId)))
            .ToList();

        var remaining = Math.Max(0, MaxListRows - ledgerReady.Count);
        if (remaining == 0)
            return ledgerReady;

        var visitCharges = await _db.ListOpenCourtVisitChargesAsync(
            assigneeId,
            claimed.ToList(),
            remaining,
            cancellationToken);

        var visitReady = visitCharges.Select(PartyBillingRowMapper.ToCourtVisitReadyDto).ToList();
        return PartyBillingStatementRules.OrderReadyLines(ledgerReady.Concat(visitReady));
    }

    public Task<IReadOnlyList<PartyBillingStatementDto>> ListStatementsAsync(
        string? assigneeId = null,
        string? status = null,
        bool issuedOrLaterOnly = false,
        CancellationToken cancellationToken = default) =>
        ListStatementsAsync(
            new PartyBillingStatementListQuery
            {
                AssigneeId = assigneeId,
                Status = status,
                IssuedOrLaterOnly = issuedOrLaterOnly,
            },
            cancellationToken);

    public async Task<PartyBillingStatementDto?> GetStatementAsync(
        Guid statementId,
        CancellationToken cancellationToken = default)
    {
        var statement = await _db.FindStatementAsync(statementId, track: false, cancellationToken);
        if (statement is null) return null;

        var lines = await _db.ListLinesForStatementsAsync([statementId], cancellationToken);

        var mapped = await MapStatementsAsync([statement], lines, cancellationToken);
        return mapped.FirstOrDefault();
    }

    public async Task<(PartyBillingStatementDto? Statement, string? Error)> IssueStatementAsync(
        Guid statementId,
        string actorUserId,
        CancellationToken cancellationToken = default)
    {
        var statement = await _db.FindStatementAsync(statementId, track: true, cancellationToken);
        if (statement is null)
            return (null, "مسير الصرف غير موجود.");

        var lineCount = await _db.CountLinesAsync(statementId, cancellationToken);
        var issueError = PartyBillingStatementRules.ValidateIssue(statement.Status, lineCount);
        if (issueError is not null)
            return (null, issueError);

        var now = _time.UtcNow();
        statement.Status = PartyBillingStatementStatus.Issued;
        statement.IssuedAtUtc = now;
        statement.IssuedByUserId = actorUserId;

        await _db.SaveChangesAsync(cancellationToken);
        if (statement.PayeeType == PartyBillingPayeeType.Vendor)
            await NotifyStatementIssuedAsync(statement, lineCount, cancellationToken);

        var dto = await GetStatementAsync(statementId, cancellationToken);
        return (dto, null);
    }

    public async Task<(PartyBillingStatementDto? Statement, string? Error)> CloseStatementAsync(
        Guid statementId,
        ClosePartyBillingStatementRequest request,
        string actorUserId,
        CancellationToken cancellationToken = default)
    {
        var statement = await _db.FindStatementAsync(statementId, track: true, cancellationToken);
        if (statement is null)
            return (null, "مسير الصرف غير موجود.");

        var check = PartyBillingStatementRules.ValidateClose(statement, request);
 // Individual: promote draft to issued implicitly so path is Payment Order issued → paid
        if (check.PromoteDraftToIssued)
        {
            statement.Status = PartyBillingStatementStatus.Issued;
            statement.IssuedAtUtc = _time.UtcNow();
            statement.IssuedByUserId = actorUserId;
        }

        if (check.Error is not null)
            return (null, check.Error);

        var receiptExists = await _attachments.ExistsAsync(check.ReceiptAttachmentId, cancellationToken);
        if (!receiptExists)
            return (null, "مرفق إيصال التحويل غير موجود.");

        var voucherTaken = await _db.IsVoucherTakenAsync(statementId, check.Voucher, cancellationToken);
        if (voucherTaken)
            return (null, "رقم سند الصرف مُستخدم مسبقاً — لا صرف مزدوج.");

        var lines = await _db.ListLinesForStatementAsync(statementId, cancellationToken);
        var lineKeys = lines.Select(l => l.WorkflowTaskId).ToList();
        var ledgers = await _db.ListLedgersByTaskIdsAsync(lineKeys, track: true, cancellationToken);
        var visitCharges = await _db.ListOpenCourtVisitChargesByIdsAsync(lineKeys, cancellationToken);

        var now = _time.UtcNow();
        PartyBillingStatementRules.ApplyClose(
            statement,
            check,
            request.Notes,
            request.PaidAtUtc?.ToUniversalTime() ?? now,
            actorUserId,
            now);

        foreach (var ledger in ledgers)
        {
            _db.AddTransition(PartyBillingStatementRules.Disburse(
                ledger,
                check.Voucher,
                actorUserId,
                now));
        }

        foreach (var charge in visitCharges)
        {
            charge.Status = CourtVisitFeeStatuses.Settled;
            charge.UpdatedAtUtc = now;
        }

        await _db.SaveChangesAsync(cancellationToken);
        await NotifyStatementClosedAsync(
            statement,
            ledgers.Count + visitCharges.Count,
            cancellationToken);

        var dto = await GetStatementAsync(statementId, cancellationToken);
        return (dto, null);
    }

    public async Task<DeferPartyBillingLinesResponseDto> DeferLinesAsync(
        DeferPartyBillingLinesRequest request,
        string actorUserId,
        CancellationToken cancellationToken = default)
    {
        var taskIds = PartyBillingRowMapper.ParseTaskIds(request.WorkflowTaskIds);
        var succeeded = new List<PartyBillingReadyLineDto>();
        var failed = new List<InspectorFeeTransitionErrorDto>();

        if (taskIds.Count == 0)
            return new DeferPartyBillingLinesResponseDto { Deferred = succeeded, Failed = failed };

        var ledgers = await _db.ListLedgersByTaskIdsAsync(taskIds, track: true, cancellationToken);

        var kindByTask = (await _lookup.GetWorkflowTaskKindsAsync(taskIds, cancellationToken))
            .Where(kv => StatementKinds.Contains(kv.Value))
            .ToDictionary(kv => kv.Key, kv => kv.Value);

        var labels = await LoadPropertyLabelsAsync(
            PartyBillingStatementRules.PropertyIdsOf(ledgers),
            cancellationToken);
        var now = _time.UtcNow();

        foreach (var taskId in taskIds)
        {
            var ledger = ledgers.FirstOrDefault(l => l.WorkflowTaskId == taskId);
            var lineError = PartyBillingStatementRules.DeferLineError(
                ledger,
                kindByTask.ContainsKey(taskId));
            if (lineError is not null || ledger is null)
            {
                failed.Add(new InspectorFeeTransitionErrorDto
                {
                    WorkflowTaskId = taskId.ToString(),
                    Error = lineError ?? "البند غير موجود.",
                });
                continue;
            }

            _db.AddTransition(PartyBillingStatementRules.Defer(
                ledger,
                PartyBillingStatementRules.AccountantDeferralReason,
                actorUserId,
                now));
            succeeded.Add(PartyBillingRowMapper.ToReadyDto(ledger, labels, kindByTask.GetValueOrDefault(taskId)));
        }

        if (succeeded.Count > 0)
            await _db.SaveChangesAsync(cancellationToken);

        return new DeferPartyBillingLinesResponseDto { Deferred = succeeded, Failed = failed };
    }

    public async Task<(PartyBillingStatementDto? Statement, string? Error)> CancelStatementAsync(
        Guid statementId,
        CancelPartyBillingStatementRequest request,
        string actorUserId,
        CancellationToken cancellationToken = default)
    {
        var statement = await _db.FindStatementAsync(statementId, track: true, cancellationToken);
        if (statement is null)
            return (null, "مسير الصرف غير موجود.");
        var (cancelError, reason) = PartyBillingStatementRules.ValidateCancel(
            statement.Status,
            statement.VendorInvoiceMatchedAtUtc,
            request.Reason);
        if (cancelError is not null)
            return (null, cancelError);

        var lines = await _db.ListLinesForStatementAsync(statementId, cancellationToken);
        var taskIds = lines.Select(l => l.WorkflowTaskId).ToList();
        var ledgers = await _db.ListLedgersByTaskIdsAsync(taskIds, track: true, cancellationToken);

        var now = _time.UtcNow();
        statement.Status = PartyBillingStatementStatus.Cancelled;
        statement.CancelledAtUtc = now;
        statement.CancelledByUserId = actorUserId;
        statement.CancelReason = reason;

        foreach (var ledger in ledgers)
        {
            _db.AddTransition(PartyBillingStatementRules.ReturnToFinance(
                ledger,
                statement.ReferenceNumber,
                reason,
                actorUserId,
                now));
        }

        await _db.SaveChangesAsync(cancellationToken);
        return (await GetStatementAsync(statementId, cancellationToken), null);
    }

    private async Task<IReadOnlyList<PartyBillingStatementDto>> MapStatementsAsync(
        IReadOnlyList<PartyBillingStatement> statements,
        IReadOnlyList<PartyBillingStatementLine> lines,
        CancellationToken cancellationToken)
    {
        var taskIds = lines.Select(l => l.WorkflowTaskId).Distinct().ToList();
        var ledgerRows = await _db.ListLedgersByTaskIdsAsync(taskIds, track: false, cancellationToken);
        var chargeRows = await _db.ListCourtVisitChargesByIdsAsync(
            taskIds, track: false, cancellationToken);

        var labels = await LoadPropertyLabelsAsync(
            PartyBillingStatementRules.PropertyIdsOf(ledgerRows),
            cancellationToken);

        return PartyBillingStatementRules.MapStatements(
            statements,
            lines,
            ledgerRows,
            chargeRows,
            labels);
    }

    private async Task<Dictionary<Guid, string>> LoadPropertyLabelsAsync(
        IReadOnlyList<Guid> propertyIds,
        CancellationToken cancellationToken)
    {
        if (propertyIds.Count == 0) return new Dictionary<Guid, string>();

        var snapshots = await _lookup.ListPropertiesByIdsAsync(propertyIds, cancellationToken);
        return PartyBillingStatementRules.PropertyLabels(snapshots);
    }
}
