using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Notifications;
using RealEstateEval.Financial.Domain;
using RealEstateEval.Financial.Infrastructure.Data.Contexts;
using RealEstateEval.Attachments.Application.Abstractions;
using RealEstateEval.Financial.Application.Rules;
using RealEstateEval.Operations.Application.Abstractions;
using static RealEstateEval.Financial.Application.Rules.PartyBillingRowMapper;

namespace RealEstateEval.Financial.Infrastructure.Services;

public partial class PartyBillingStatementService : IPartyBillingStatementService
{
    private const int MaxListRows = 500;

 /// <summary>ledger-backed party fee kinds (workflow + inspector fee ledger).</summary>
    private static readonly IReadOnlySet<WorkflowTaskKind> StatementKinds =
        PartyBillingStatementRules.StatementKinds;

 /// <summary>Ops court-visit fee charges — individual payee, same statement close path as individuals.</summary>
    public const string CourtVisitTaskKind = PartyBillingStatementRules.CourtVisitTaskKind;

    private readonly FinancialDbContext _db;
    private readonly ICaseStudyLookup _lookup;
    private readonly ICaseStudyCommands _commands;
    private readonly IAttachmentLookup _attachments;
    private readonly INotificationService _notifications;
    private readonly NotificationRecipientResolver _recipients;
    private readonly IOperationsTaskService? _opsTasks;
    private readonly ICourtVisitFeeBackfill? _visitFees;
    private readonly ILogger<PartyBillingStatementService> _logger;
    private readonly TimeProvider _time;

    public PartyBillingStatementService(
        FinancialDbContext db,
        ICaseStudyLookup lookup,
        ICaseStudyCommands commands,
        IAttachmentLookup attachments,
        INotificationService notifications,
        NotificationRecipientResolver recipients,
        ICourtVisitFeeBackfill visitFees,
        ILogger<PartyBillingStatementService> logger,
        TimeProvider? time = null)
        : this(
            db,
            lookup,
            commands,
            attachments,
            notifications,
            recipients,
            opsTasks: null,
            visitFees,
            logger,
            time)
    {
    }

    // DI path in Finance host: backfill passes through HTTP client for operations tasks (available since E6)
    // — Null was passed, so compensation before “ready lines” does not work at all in production.
    [ActivatorUtilitiesConstructor]
    public PartyBillingStatementService(
        FinancialDbContext db,
        ICaseStudyLookup lookup,
        ICaseStudyCommands commands,
        IAttachmentLookup attachments,
        INotificationService notifications,
        NotificationRecipientResolver recipients,
        ILogger<PartyBillingStatementService> logger,
        TimeProvider? time = null,
        IOperationsTaskService? opsTasks = null)
        : this(db, lookup, commands, attachments, notifications, recipients, opsTasks, visitFees: null, logger, time)
    {
    }

    private PartyBillingStatementService(
        FinancialDbContext db,
        ICaseStudyLookup lookup,
        ICaseStudyCommands commands,
        IAttachmentLookup attachments,
        INotificationService notifications,
        NotificationRecipientResolver recipients,
        IOperationsTaskService? opsTasks,
        ICourtVisitFeeBackfill? visitFees,
        ILogger<PartyBillingStatementService> logger,
        TimeProvider? time)
    {
        _time = time ?? TimeProvider.System;

        _db = db;
        _lookup = lookup;
        _commands = commands;
        _attachments = attachments;
        _notifications = notifications;
        _recipients = recipients;
        _opsTasks = opsTasks;
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
            if (_opsTasks is not null)
                await _opsTasks.BackfillMissingCourtVisitChargesAsync(cancellationToken);
            else if (_visitFees is not null)
                await _visitFees.BackfillMissingChargesForCompletedVisitsAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Court-visit fee backfill before ready-lines failed");
        }

 // WorkflowTaskId is unique on statement lines — once billed (even paid/cancelled line),
 // twin reassignment ledgers must not reappear as dues.
 // Court-visit charges reuse the same column with charge.Id as the line key.
        var claimedTaskIds = await _db.PartyBillingStatementLines.AsNoTracking()
            .Select(l => l.WorkflowTaskId)
            .Distinct()
            .ToListAsync(cancellationToken);
        var claimed = claimedTaskIds.ToHashSet();

 // Cross-context: materialize statement-kind task ids from Case Study, then filter Financial ledgers.
        var statementTasks = (await _lookup.ListWorkflowTasksByKindsAsync(
                [.. StatementKinds],
                cancellationToken))
            .Select(task => new { task.Id, Kind = PartyBillingRowMapper.ParseKind(task.Kind) })
            .Where(task => StatementKinds.Contains(task.Kind))
            .ToList();
        var kindByTaskId = statementTasks.ToDictionary(task => task.Id, task => task.Kind);
        var statementTaskIds = kindByTaskId.Keys.ToList();

        var ledgerRows = statementTaskIds.Count == 0
            ? []
            : await _db.InspectorFeeLedgers.AsNoTracking()
                .Where(ledger =>
                    statementTaskIds.Contains(ledger.WorkflowTaskId)
                    && !ledger.ExcludedFromBatch
                    && (ledger.BillingStatus == InspectorFeeBillingStatus.AtFinance
                        || ledger.BillingStatus == InspectorFeeBillingStatus.Deferred)
                    && (assigneeId == null
                        || ledger.AssigneeId == assigneeId))
                .OrderByDescending(ledger => ledger.UpdatedAtUtc)
                .Take(MaxListRows)
                .ToListAsync(cancellationToken);

        ledgerRows = ledgerRows.Where(ledger => !claimed.Contains(ledger.WorkflowTaskId)).ToList();

 // Reassignment twins + multi-deed share one statement line (unique WorkflowTaskId).
 // Surface one ready row per task.
        var ledgers = PartyBillingStatementRules.PickOneLedgerPerTask(ledgerRows);
        var kindByTask = ledgers.ToDictionary(
            ledger => ledger.WorkflowTaskId,
            ledger => kindByTaskId.GetValueOrDefault(ledger.WorkflowTaskId));

        var propertyIds = ledgers
            .Select(l => l.PropertyId)
            .Where(id => id.HasValue)
            .Select(id => id!.Value)
            .Distinct()
            .ToList();

        var labels = await LoadPropertyLabelsAsync(propertyIds, cancellationToken);

        var ledgerReady = ledgers
            .OrderByDescending(l => l.UpdatedAtUtc)
            .Select(l => PartyBillingRowMapper.ToReadyDto(l, labels, kindByTask.GetValueOrDefault(l.WorkflowTaskId)))
            .ToList();

        var remaining = Math.Max(0, MaxListRows - ledgerReady.Count);
        if (remaining == 0)
            return ledgerReady;

        var visitQuery = _db.CourtVisitFeeCharges.AsNoTracking()
            .Where(c => c.Status == CourtVisitFeeStatuses.Open
                && c.AmountSar > 0
                && !claimed.Contains(c.Id));
        if (!string.IsNullOrWhiteSpace(assigneeId))
        {
            var aid = assigneeId.Trim();
            visitQuery = visitQuery.Where(c => c.CreditAssigneeId == aid);
        }

        var visitCharges = await visitQuery
            .OrderByDescending(c => c.UpdatedAtUtc)
            .Take(remaining)
            .ToListAsync(cancellationToken);

        var visitReady = visitCharges.Select(PartyBillingRowMapper.ToCourtVisitReadyDto).ToList();
        return PartyBillingStatementRules.OrderReadyLines(ledgerReady.Concat(visitReady));
    }

    public async Task<IReadOnlyList<PartyBillingStatementDto>> ListStatementsAsync(
        string? assigneeId = null,
        string? status = null,
        bool issuedOrLaterOnly = false,
        CancellationToken cancellationToken = default)
    {
        var query = _db.PartyBillingStatements.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(assigneeId))
            query = query.Where(s => s.AssigneeId == assigneeId);

        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(s => s.Status == status);

        if (issuedOrLaterOnly)
        {
            query = query.Where(s =>
                s.Status == PartyBillingStatementStatus.Issued
                || s.Status == PartyBillingStatementStatus.InvoiceReceived
                || s.Status == PartyBillingStatementStatus.Closed);
        }

        var statements = await query
            .OrderByDescending(s => s.CreatedAtUtc)
            .Take(MaxListRows)
            .ToListAsync(cancellationToken);

        if (statements.Count == 0) return [];

        var ids = statements.Select(s => s.Id).ToList();
        var lines = await _db.PartyBillingStatementLines.AsNoTracking()
            .Where(l => ids.Contains(l.StatementId))
            .ToListAsync(cancellationToken);

        return await MapStatementsAsync(statements, lines, cancellationToken);
    }

    public async Task<PartyBillingStatementDto?> GetStatementAsync(
        Guid statementId,
        CancellationToken cancellationToken = default)
    {
        var statement = await _db.PartyBillingStatements.AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == statementId, cancellationToken);
        if (statement is null) return null;

        var lines = await _db.PartyBillingStatementLines.AsNoTracking()
            .Where(l => l.StatementId == statementId)
            .ToListAsync(cancellationToken);

        var mapped = await MapStatementsAsync([statement], lines, cancellationToken);
        return mapped.FirstOrDefault();
    }

    public async Task<CreatePartyBillingStatementResponseDto> CreateStatementAsync(
        CreatePartyBillingStatementRequest request,
        string actorUserId,
        CancellationToken cancellationToken = default)
    {
        var taskIds = ParseTaskIds(request.WorkflowTaskIds);
        if (taskIds.Count == 0)
        {
            return new CreatePartyBillingStatementResponseDto
            {
                Error = "اختر بنداً واحداً على الأقل لإنشاء كشف الفوترة.",
            };
        }

 // Court-visit open charges use charge.Id as the ready-line key (same column as workflow task id).
        var openCharges = await _db.CourtVisitFeeCharges
            .Where(c => taskIds.Contains(c.Id)
                && c.Status == CourtVisitFeeStatuses.Open
                && c.AmountSar > 0)
            .ToListAsync(cancellationToken);
        var mixError = PartyBillingStatementRules.ValidateCourtVisitMix(openCharges.Count, taskIds.Count);
        if (mixError is not null)
            return new CreatePartyBillingStatementResponseDto { Error = mixError };

        if (openCharges.Count > 0)
        {
            return await CreateCourtVisitStatementAsync(
                taskIds,
                openCharges,
                request,
                actorUserId,
                cancellationToken);
        }

        var candidates = await _db.InspectorFeeLedgers
            .Where(l => taskIds.Contains(l.WorkflowTaskId))
            .ToListAsync(cancellationToken);

 // Unique IX on PartyBillingStatementLines.WorkflowTaskId — cannot re-bill a task.
        var alreadyLined = await _db.PartyBillingStatementLines.AsNoTracking()
            .Where(l => taskIds.Contains(l.WorkflowTaskId))
            .Select(l => l.WorkflowTaskId)
            .Distinct()
            .ToListAsync(cancellationToken);

        var kinds = await _lookup.GetWorkflowTaskKindsAsync(taskIds, cancellationToken);
        var plan = PartyBillingStatementRules.BuildLedgerStatementPlan(
            taskIds,
            candidates,
            alreadyLined,
            kinds);
        if (plan.Error is not null)
            return new CreatePartyBillingStatementResponseDto { Error = plan.Error };

        var ledgerGroups = plan.Groups;
        var statementKind = plan.StatementKind;
        var assigneeId = plan.AssigneeId;

        var now = _time.UtcNow();
        string reference;
        try
        {
            reference = await NextReferenceAsync(now, cancellationToken);
        }
        catch (Exception ex)
        {
 // Reference allocation reads a sequence and can surface storage-level detail.
 // Keep it in the log; the caller only learns that the attempt failed.
            _logger.LogError(
                ex,
                "Failed to allocate an engineering billing statement reference for assignee {AssigneeId}",
                assigneeId);
            return new CreatePartyBillingStatementResponseDto
            {
                Error = "تعذر إنشاء كشف الفوترة. حاول مرة أخرى، وإذا تكرر الخطأ راجع الدعم الفني.",
            };
        }

        var statementId = Guid.NewGuid();
        var total = 0m;
        var statementLines = new List<PartyBillingStatementLine>();

        foreach (var group in ledgerGroups)
        {
            var groupLedgers = group.Value;
            var net = PartyBillingStatementRules.NetForGroup(groupLedgers);
            total += net;

            foreach (var ledger in groupLedgers)
            {
                var fromStatus = ledger.BillingStatus;
                ledger.BillingStatus = InspectorFeeBillingStatus.InStatement;
                ledger.PartyBillingStatementId = statementId;
                ledger.UpdatedAtUtc = now;
                _db.InspectorFeeTransitions.Add(PartyBillingStatementRules.Transition(
                    ledger,
                    fromStatus,
                    InspectorFeeBillingStatus.InStatement,
                    PartyBillingStatementRules.InsertedInStatementReason(reference),
                    actorUserId,
                    now));
            }

            statementLines.Add(new PartyBillingStatementLine
            {
                Id = Guid.NewGuid(),
                StatementId = statementId,
                WorkflowTaskId = group.Key,
                NetFeeSar = net,
            });
        }

        var deferredDtos = new List<PartyBillingReadyLineDto>();
        if (request.DeferUnselectedForAssignee)
        {
            var selectedSet = taskIds.ToHashSet();
            var unselected = await _db.InspectorFeeLedgers
                .Where(l =>
                    l.AssigneeId == assigneeId
                    && l.BillingStatus == InspectorFeeBillingStatus.AtFinance
                    && !l.ExcludedFromBatch
                    && !selectedSet.Contains(l.WorkflowTaskId)
                    && !l.PartyBillingStatementId.HasValue)
                .ToListAsync(cancellationToken);

            var unselectedIds = unselected.Select(l => l.WorkflowTaskId).ToList();
            if (unselectedIds.Count > 0)
            {
 // Defer only same-kind leftovers for this assignee.
                var sameKindTasks = (await _lookup.GetWorkflowTaskKindsAsync(
                        unselectedIds, cancellationToken))
                    .Where(kv => kv.Value == statementKind)
                    .Select(kv => new { Id = kv.Key, Kind = kv.Value })
                    .ToList();
                var sameKindUnselected = sameKindTasks.Select(t => t.Id).ToHashSet();

                var propertyIds = unselected
                    .Where(l => sameKindUnselected.Contains(l.WorkflowTaskId) && l.PropertyId.HasValue)
                    .Select(l => l.PropertyId!.Value)
                    .Distinct()
                    .ToList();
                var labels = await LoadPropertyLabelsAsync(propertyIds, cancellationToken);

                foreach (var ledger in unselected.Where(l => sameKindUnselected.Contains(l.WorkflowTaskId)))
                {
                    ledger.BillingStatus = InspectorFeeBillingStatus.Deferred;
                    ledger.UpdatedAtUtc = now;
                    _db.InspectorFeeTransitions.Add(PartyBillingStatementRules.Transition(
                        ledger,
                        InspectorFeeBillingStatus.AtFinance,
                        InspectorFeeBillingStatus.Deferred,
                        PartyBillingStatementRules.NotInStatementDeferralReason(reference),
                        actorUserId,
                        now));
                    deferredDtos.Add(ToReadyDto(ledger, labels, statementKind));
                }
            }
        }

        _db.PartyBillingStatements.Add(new PartyBillingStatement
        {
            Id = statementId,
            ReferenceNumber = reference,
            AssigneeId = assigneeId,
            PayeeType = PartyBillingPayeeType.FromTaskKind(statementKind),
            TaskKind = statementKind.ToDbValue(),
            Status = PartyBillingStatementStatus.Draft,
            TotalNetSar = total,
            CreatedByUserId = actorUserId,
            CreatedAtUtc = now,
            Notes = PartyBillingStatementRules.NormalizeNotes(request.Notes),
            Lines = statementLines,
        });

        await _db.SaveChangesAsync(cancellationToken);

        var dto = await GetStatementAsync(statementId, cancellationToken);
        return new CreatePartyBillingStatementResponseDto
        {
            Statement = dto,
            DeferredLines = deferredDtos,
        };
    }

    public async Task<(PartyBillingStatementDto? Statement, string? Error)> IssueStatementAsync(
        Guid statementId,
        string actorUserId,
        CancellationToken cancellationToken = default)
    {
        var statement = await _db.PartyBillingStatements
            .FirstOrDefaultAsync(s => s.Id == statementId, cancellationToken);
        if (statement is null)
            return (null, "مسير الصرف غير موجود.");

        var lineCount = await _db.PartyBillingStatementLines
            .CountAsync(l => l.StatementId == statementId, cancellationToken);
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
        var statement = await _db.PartyBillingStatements
            .FirstOrDefaultAsync(s => s.Id == statementId, cancellationToken);
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

        var voucher = check.Voucher;
        var transferRef = check.TransferReference;
        var receiptId = check.ReceiptAttachmentId;

        var receiptExists = await _attachments.ExistsAsync(receiptId, actor: null, cancellationToken);
        if (!receiptExists)
            return (null, "مرفق إيصال التحويل غير موجود.");

        var voucherTaken = await _db.PartyBillingStatements.AsNoTracking().AnyAsync(
            s => s.Id != statementId
                && s.DisbursementVoucher != null
                && s.DisbursementVoucher == voucher,
            cancellationToken);
        if (voucherTaken)
            return (null, "رقم سند الصرف مُستخدم مسبقاً — لا صرف مزدوج.");

        var receiptRef = check.TransferReceiptRef;

        var lines = await _db.PartyBillingStatementLines
            .Where(l => l.StatementId == statementId)
            .ToListAsync(cancellationToken);
        var lineKeys = lines.Select(l => l.WorkflowTaskId).ToList();
        var ledgers = await _db.InspectorFeeLedgers
            .Where(l => lineKeys.Contains(l.WorkflowTaskId))
            .ToListAsync(cancellationToken);
        var visitCharges = await _db.CourtVisitFeeCharges
            .Where(c => lineKeys.Contains(c.Id) && c.Status == CourtVisitFeeStatuses.Open)
            .ToListAsync(cancellationToken);

        var now = _time.UtcNow();
        var paidAt = request.PaidAtUtc?.ToUniversalTime() ?? now;

        statement.Status = PartyBillingStatementStatus.Closed;
        statement.ClosedAtUtc = now;
        statement.ClosedByUserId = actorUserId;
        statement.DisbursementVoucher = voucher;
        statement.TransferReference = transferRef;
        statement.TransferReceiptAttachmentId = receiptId;
        statement.TransferReceiptRef = receiptRef;
        statement.ExternalInvoiceNumber =
            PartyBillingStatementRules.ExternalInvoiceOnClose(statement, voucher);
        statement.PaidAtUtc = paidAt;
        if (!string.IsNullOrWhiteSpace(request.Notes))
            statement.Notes = request.Notes.Trim();

        foreach (var ledger in ledgers)
        {
            var fromStatus = ledger.BillingStatus;
            ledger.BillingStatus = InspectorFeeBillingStatus.Disbursed;
            ledger.DisbursementVoucher = voucher;
            ledger.UpdatedAtUtc = now;
            _db.InspectorFeeTransitions.Add(PartyBillingStatementRules.Transition(
                ledger,
                fromStatus,
                InspectorFeeBillingStatus.Disbursed,
                PartyBillingStatementRules.DisbursedReason(voucher),
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

        var ledgers = await _db.InspectorFeeLedgers
            .Where(l => taskIds.Contains(l.WorkflowTaskId))
            .ToListAsync(cancellationToken);

        var statementIds = (await _lookup.GetWorkflowTaskKindsAsync(taskIds, cancellationToken))
            .Where(kv => StatementKinds.Contains(kv.Value))
            .Select(kv => new { Id = kv.Key, Kind = kv.Value })
            .ToList();
        var kindByTask = statementIds.ToDictionary(t => t.Id, t => t.Kind);
        var statementTaskIdSet = kindByTask.Keys.ToHashSet();

        var propertyIds = ledgers
            .Where(l => l.PropertyId.HasValue)
            .Select(l => l.PropertyId!.Value)
            .Distinct()
            .ToList();
        var labels = await LoadPropertyLabelsAsync(propertyIds, cancellationToken);
        var now = _time.UtcNow();

        foreach (var taskId in taskIds)
        {
            var ledger = ledgers.FirstOrDefault(l => l.WorkflowTaskId == taskId);
            var lineError = PartyBillingStatementRules.DeferLineError(
                ledger,
                statementTaskIdSet.Contains(taskId));
            if (lineError is not null || ledger is null)
            {
                failed.Add(new InspectorFeeTransitionErrorDto
                {
                    WorkflowTaskId = taskId.ToString(),
                    Error = lineError ?? "البند غير موجود.",
                });
                continue;
            }

            ledger.BillingStatus = InspectorFeeBillingStatus.Deferred;
            ledger.UpdatedAtUtc = now;
            _db.InspectorFeeTransitions.Add(PartyBillingStatementRules.Transition(
                ledger,
                InspectorFeeBillingStatus.AtFinance,
                InspectorFeeBillingStatus.Deferred,
                PartyBillingStatementRules.AccountantDeferralReason,
                actorUserId,
                now));
            succeeded.Add(PartyBillingRowMapper.ToReadyDto(ledger, labels, kindByTask.GetValueOrDefault(taskId)));
        }

        if (succeeded.Count > 0)
            await _db.SaveChangesAsync(cancellationToken);

        return new DeferPartyBillingLinesResponseDto { Deferred = succeeded, Failed = failed };
    }

    public async Task<CreateMonthPartyBillingStatementsResponseDto> CreateMonthVendorStatementsAsync(
        string actorUserId,
        CancellationToken cancellationToken = default)
    {
        var ready = await ListReadyLinesAsync(cancellationToken: cancellationToken);
        var vendorReady = ready
            .Where(l => l.PayeeType == PartyBillingPayeeType.Vendor && l.AssigneeId is not null)
            .GroupBy(l => l.AssigneeId!, StringComparer.Ordinal)
            .ToList();

        if (vendorReady.Count == 0)
        {
            return new CreateMonthPartyBillingStatementsResponseDto
            {
                Error = "لا بنود مورّد جاهزة لإنشاء مسيرات.",
            };
        }

        var monthStart = PartyBillingStatementRules.MonthStart(_time.UtcNow());
        var created = new List<PartyBillingStatementDto>();
        var linesIncluded = 0;

 // One query for open pipelines this month instead of AnyAsync per vendor.
        var vendorIds = vendorReady.Select(g => g.Key).ToList();
        var openThisMonth = (await _db.PartyBillingStatements.AsNoTracking()
                .Where(s =>
                    s.AssigneeId != null
                    && vendorIds.Contains(s.AssigneeId)
                    && s.PayeeType == PartyBillingPayeeType.Vendor
                    && s.CreatedAtUtc >= monthStart
                    && (s.Status == PartyBillingStatementStatus.Draft
                        || s.Status == PartyBillingStatementStatus.Issued
                        || s.Status == PartyBillingStatementStatus.InvoiceReceived))
                .Select(s => s.AssigneeId!)
                .ToListAsync(cancellationToken))
            .ToHashSet(StringComparer.Ordinal);

        foreach (var group in vendorReady)
        {
            if (openThisMonth.Contains(group.Key)) continue;

            var result = await CreateStatementAsync(
                new CreatePartyBillingStatementRequest
                {
                    WorkflowTaskIds = group.Select(l => l.WorkflowTaskId).ToList(),
                    DeferUnselectedForAssignee = false,
                    Notes = $"مسير آلي — {monthStart:yyyy-MM}",
                },
                actorUserId,
                cancellationToken);

            if (result.Error is not null || result.Statement is null)
            {
                _logger.LogWarning(
                    "Month vendor statement skipped for assignee {AssigneeId}: {Error}",
                    group.Key,
                    result.Error);
                continue;
            }

            created.Add(result.Statement);
            linesIncluded += result.Statement.Lines.Count;
        }

        return new CreateMonthPartyBillingStatementsResponseDto
        {
            Created = created,
            AssigneesCovered = created.Count,
            LinesIncluded = linesIncluded,
            Error = created.Count == 0
                ? "لم يُنشأ أي مسير — قد تكون المسيرات مفتوحة مسبقاً لنفس الشهر."
                : null,
        };
    }

    public async Task<(PartyBillingStatementDto? Statement, string? Error)> CancelStatementAsync(
        Guid statementId,
        CancelPartyBillingStatementRequest request,
        string actorUserId,
        CancellationToken cancellationToken = default)
    {
        var statement = await _db.PartyBillingStatements
            .FirstOrDefaultAsync(s => s.Id == statementId, cancellationToken);
        if (statement is null)
            return (null, "مسير الصرف غير موجود.");
        var (cancelError, reason) = PartyBillingStatementRules.ValidateCancel(
            statement.Status,
            statement.VendorInvoiceMatchedAtUtc,
            request.Reason);
        if (cancelError is not null)
            return (null, cancelError);

        var lines = await _db.PartyBillingStatementLines
            .Where(l => l.StatementId == statementId)
            .ToListAsync(cancellationToken);
        var taskIds = lines.Select(l => l.WorkflowTaskId).ToList();
        var ledgers = await _db.InspectorFeeLedgers
            .Where(l => taskIds.Contains(l.WorkflowTaskId))
            .ToListAsync(cancellationToken);

        var now = _time.UtcNow();
        statement.Status = PartyBillingStatementStatus.Cancelled;
        statement.CancelledAtUtc = now;
        statement.CancelledByUserId = actorUserId;
        statement.CancelReason = reason;

        foreach (var ledger in ledgers)
        {
            var from = ledger.BillingStatus;
            ledger.BillingStatus = InspectorFeeBillingStatus.AtFinance;
            ledger.PartyBillingStatementId = null;
            ledger.UpdatedAtUtc = now;
            _db.InspectorFeeTransitions.Add(PartyBillingStatementRules.Transition(
                ledger,
                from,
                InspectorFeeBillingStatus.AtFinance,
                PartyBillingStatementRules.CancelledReason(statement.ReferenceNumber, reason),
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
        var ledgerRows = await _db.InspectorFeeLedgers.AsNoTracking()
            .Where(l => taskIds.Contains(l.WorkflowTaskId))
            .ToListAsync(cancellationToken);
        var chargeRows = await _db.CourtVisitFeeCharges.AsNoTracking()
            .Where(c => taskIds.Contains(c.Id))
            .ToListAsync(cancellationToken);

        var propertyIds = ledgerRows
            .Where(l => l.PropertyId.HasValue)
            .Select(l => l.PropertyId!.Value)
            .Distinct()
            .ToList();
        var labels = await LoadPropertyLabelsAsync(propertyIds, cancellationToken);

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

    private async Task<CreatePartyBillingStatementResponseDto> CreateCourtVisitStatementAsync(
        IReadOnlyList<Guid> chargeIds,
        IReadOnlyList<CourtVisitFeeCharge> charges,
        CreatePartyBillingStatementRequest request,
        string actorUserId,
        CancellationToken cancellationToken)
    {
        var alreadyLined = await _db.PartyBillingStatementLines.AsNoTracking()
            .Where(l => chargeIds.Contains(l.WorkflowTaskId))
            .Select(l => l.WorkflowTaskId)
            .Distinct()
            .ToListAsync(cancellationToken);
        var (selectionError, assigneeId) =
            PartyBillingStatementRules.ValidateCourtVisitSelection(charges, alreadyLined);
        if (selectionError is not null)
            return new CreatePartyBillingStatementResponseDto { Error = selectionError };

        var now = _time.UtcNow();
        string reference;
        try
        {
            reference = await NextReferenceAsync(now, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "Failed to allocate billing statement reference for court-visit assignee {AssigneeId}",
                assigneeId);
            return new CreatePartyBillingStatementResponseDto
            {
                Error = "تعذر إنشاء كشف الفوترة. حاول مرة أخرى، وإذا تكرر الخطأ راجع الدعم الفني.",
            };
        }

        var statementId = Guid.NewGuid();
        var total = charges.Sum(c => c.AmountSar);
        var statementLines = charges.Select(c => new PartyBillingStatementLine
        {
            Id = Guid.NewGuid(),
            StatementId = statementId,
 // Statement line unique key = charge id (not workflow task id).
            WorkflowTaskId = c.Id,
            NetFeeSar = c.AmountSar,
        }).ToList();

        foreach (var charge in charges)
            charge.UpdatedAtUtc = now;

        _db.PartyBillingStatements.Add(new PartyBillingStatement
        {
            Id = statementId,
            ReferenceNumber = reference,
            AssigneeId = assigneeId,
            PayeeType = PartyBillingPayeeType.Individual,
            TaskKind = CourtVisitTaskKind,
            Status = PartyBillingStatementStatus.Draft,
            TotalNetSar = total,
            CreatedByUserId = actorUserId,
            CreatedAtUtc = now,
            Notes = PartyBillingStatementRules.NormalizeNotes(request.Notes),
            Lines = statementLines,
        });

        await _db.SaveChangesAsync(cancellationToken);

        var dto = await GetStatementAsync(statementId, cancellationToken);
        return new CreatePartyBillingStatementResponseDto
        {
            Statement = dto,
            DeferredLines = [],
        };
    }

}
