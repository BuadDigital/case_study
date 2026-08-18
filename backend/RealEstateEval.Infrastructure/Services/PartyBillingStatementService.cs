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

namespace RealEstateEval.Infrastructure.Services;

public class PartyBillingStatementService : IPartyBillingStatementService
{
    private const int MaxListRows = 500;
    private const string RefDept = "FN";
    private const string RefType = "CS";

 /// <summary>ledger-backed party fee kinds (workflow + inspector fee ledger).</summary>
    private static readonly HashSet<WorkflowTaskKind> StatementKinds =
    [
        WorkflowTaskKind.FieldInspection,
        WorkflowTaskKind.GovernmentReview,
        WorkflowTaskKind.EngineeringSurvey,
    ];

 /// <summary>Ops court-visit fee charges — individual payee, same statement close path as individuals.</summary>
    public const string CourtVisitTaskKind = WorkflowTaskKindValues.CourtVisit;

    private readonly FinancialDbContext _db;
    private readonly ICaseStudyLookup _lookup;
    private readonly ICaseStudyCommands _commands;
    private readonly IAttachmentLookup _attachments;
    private readonly INotificationService _notifications;
    private readonly NotificationRecipientResolver _recipients;
    private readonly IOperationsTaskService? _opsTasks;
    private readonly OperationsTaskVisitFeeHelper? _visitFees;
    private readonly ILogger<PartyBillingStatementService> _logger;
    private readonly TimeProvider _time;

    public PartyBillingStatementService(
        FinancialDbContext db,
        CaseStudyDbContext caseStudy,
        IAttachmentLookup attachments,
        INotificationService notifications,
        NotificationRecipientResolver recipients,
        OperationsTaskVisitFeeHelper visitFees,
        ILogger<PartyBillingStatementService> logger,
        TimeProvider? time = null)
        : this(
            db,
            new CaseStudyLookup(caseStudy),
            new CaseStudyCommands(caseStudy, time),
            attachments,
            notifications,
            recipients,
            opsTasks: null,
            visitFees,
            logger,
            time)
    {
    }

    [ActivatorUtilitiesConstructor]
    public PartyBillingStatementService(
        FinancialDbContext db,
        ICaseStudyLookup lookup,
        ICaseStudyCommands commands,
        IAttachmentLookup attachments,
        INotificationService notifications,
        NotificationRecipientResolver recipients,
        ILogger<PartyBillingStatementService> logger,
        TimeProvider? time = null)
        : this(db, lookup, commands, attachments, notifications, recipients, opsTasks: null, visitFees: null, logger, time)
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
        OperationsTaskVisitFeeHelper? visitFees,
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
            .Select(task => new { task.Id, Kind = ParseKind(task.Kind) })
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
        var ledgers = CollapseReadyLedgers(ledgerRows)
            .GroupBy(l => l.WorkflowTaskId)
            .Select(g => g
                .OrderByDescending(l => l.UpdatedAtUtc)
                .ThenByDescending(l => l.CreatedAtUtc)
                .First())
            .ToList();
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
            .Select(l => ToReadyDto(l, labels, kindByTask.GetValueOrDefault(l.WorkflowTaskId)))
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

        var visitReady = visitCharges.Select(ToCourtVisitReadyDto).ToList();
        return ledgerReady
            .Concat(visitReady)
            .OrderByDescending(l => l.UpdatedAtUtc ?? l.AccruedAtUtc ?? DateTime.MinValue)
            .ToList();
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
        if (openCharges.Count > 0)
        {
            if (openCharges.Count != taskIds.Count)
            {
                return new CreatePartyBillingStatementResponseDto
                {
                    Error = "لا تُخلط أتعاب زيارة المحكمة مع بنود أخرى في نفس أمر الصرف.",
                };
            }

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

        var missingTaskIds = taskIds
            .Where(id => candidates.All(l => l.WorkflowTaskId != id))
            .ToList();
        if (missingTaskIds.Count > 0)
        {
            return new CreatePartyBillingStatementResponseDto
            {
                Error = "بعض البنود المحددة غير موجودة في سجل الأتعاب.",
            };
        }

 // Unique IX on PartyBillingStatementLines.WorkflowTaskId — cannot re-bill a task.
        var alreadyLined = await _db.PartyBillingStatementLines.AsNoTracking()
            .Where(l => taskIds.Contains(l.WorkflowTaskId))
            .Select(l => l.WorkflowTaskId)
            .Distinct()
            .ToListAsync(cancellationToken);
        if (alreadyLined.Count > 0)
        {
            return new CreatePartyBillingStatementResponseDto
            {
                Error = "أحد البنود مُدرج مسبقاً في مسير صرف (مدفوع أو قائم).",
            };
        }

 // Ready ledgers only; twin reassignments collapse; multi-deed stays one line per task
 // (unique WorkflowTaskId) with summed net.
        var readyForSelected = candidates
            .Where(l =>
                !l.ExcludedFromBatch
                && !l.PartyBillingStatementId.HasValue
                && InspectorFeeBillingRules.IsReadyForEngStatement(l.BillingStatus))
            .ToList();
        var ledgerGroups = CollapseReadyLedgers(readyForSelected)
            .GroupBy(l => l.WorkflowTaskId)
            .ToList();

        var notReadyTasks = taskIds
            .Where(id => ledgerGroups.All(g => g.Key != id))
            .ToList();
        if (notReadyTasks.Count > 0)
        {
            return new CreatePartyBillingStatementResponseDto
            {
                Error = "لا يُدرج في كشف الفوترة إلا البنود الجاهزة أو المرحَّلة.",
            };
        }

        var chosenIds = ledgerGroups.SelectMany(g => g).Select(l => l.Id).ToHashSet();
        var trackedLedgers = candidates.Where(l => chosenIds.Contains(l.Id)).ToList();
        var trackedByTask = trackedLedgers.GroupBy(l => l.WorkflowTaskId)
            .ToDictionary(g => g.Key, g => g.ToList());

        var kinds = await _lookup.GetWorkflowTaskKindsAsync(taskIds, cancellationToken);
        var taskKinds = kinds
            .Select(kv => new { Id = kv.Key, Kind = kv.Value })
            .ToList();

        if (taskKinds.Count != taskIds.Count
            || taskKinds.Any(t => !StatementKinds.Contains(t.Kind)))
        {
            return new CreatePartyBillingStatementResponseDto
            {
                Error = "كشف الفوترة يقبل بنود المعاينة والرفع المساحي وزيارة المحكمة (وأتعاب المراجعة القديمة إن وُجدت).",
            };
        }

        if (taskKinds.Select(t => t.Kind).Distinct().Count() != 1)
        {
            return new CreatePartyBillingStatementResponseDto
            {
                Error = "يجب أن تكون كل بنود الكشف من نفس نوع المهمة.",
            };
        }

        var statementKind = taskKinds[0].Kind;

        var assignees = trackedLedgers
            .Select(l => l.AssigneeId?.Trim() ?? "")
            .Where(a => a.Length > 0)
            .Distinct(StringComparer.Ordinal)
            .ToList();

        if (assignees.Count != 1)
        {
            return new CreatePartyBillingStatementResponseDto
            {
                Error = "يجب أن تكون كل بنود الكشف لنفس الطرف.",
            };
        }

        var assigneeId = assignees[0];

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
            var groupLedgers = trackedByTask[group.Key];
            var net = groupLedgers.Sum(l =>
                InspectorFeeRules.NetFee(l.AgreedFeeSar, l.SupervisorDiscountSar));
            total += net;

            foreach (var ledger in groupLedgers)
            {
                var fromStatus = ledger.BillingStatus;
                ledger.BillingStatus = InspectorFeeBillingStatus.InStatement;
                ledger.PartyBillingStatementId = statementId;
                ledger.UpdatedAtUtc = now;
                _db.InspectorFeeTransitions.Add(new InspectorFeeTransition
                {
                    Id = Guid.NewGuid(),
                    WorkflowTaskId = ledger.WorkflowTaskId,
                    FromStatus = fromStatus,
                    ToStatus = InspectorFeeBillingStatus.InStatement,
                    Reason = $"إدراج في كشف {reference}",
                    ActorUserId = actorUserId,
                    CreatedAtUtc = now,
                });
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
                    _db.InspectorFeeTransitions.Add(new InspectorFeeTransition
                    {
                        Id = Guid.NewGuid(),
                        WorkflowTaskId = ledger.WorkflowTaskId,
                        FromStatus = InspectorFeeBillingStatus.AtFinance,
                        ToStatus = InspectorFeeBillingStatus.Deferred,
                        Reason = $"ترحيل — لم يُدرج في كشف {reference}",
                        ActorUserId = actorUserId,
                        CreatedAtUtc = now,
                    });
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
            Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim(),
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

        if (statement.Status != PartyBillingStatementStatus.Draft)
            return (null, "لا يمكن إرسال إلا المسيرات/الأوامر في حالة المسودة.");

        var lineCount = await _db.PartyBillingStatementLines
            .CountAsync(l => l.StatementId == statementId, cancellationToken);
        if (lineCount == 0)
            return (null, "لا يمكن إرسال مستند بلا بنود.");

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

        var isVendor = statement.PayeeType == PartyBillingPayeeType.Vendor;
        if (isVendor)
        {
            if (statement.Status != PartyBillingStatementStatus.InvoiceReceived)
                return (null, "لا يُصرف للمورّد إلا بعد ورود الفاتورة ومطابقتها.");
            if (statement.VendorInvoiceMatchedAtUtc is null)
                return (null, "أقر مطابقة الفاتورة قبل توثيق الصرف.");
        }
        else
        {
            if (statement.Status != PartyBillingStatementStatus.Issued
                && statement.Status != PartyBillingStatementStatus.Draft)
                return (null, "لا يُصرف للفرد إلا من أمر صرف صادر أو مُعد.");
 // Individual: promote draft to issued implicitly so path is أمر صرف صادر → مدفوع
            if (statement.Status == PartyBillingStatementStatus.Draft)
            {
                statement.Status = PartyBillingStatementStatus.Issued;
                statement.IssuedAtUtc = _time.UtcNow();
                statement.IssuedByUserId = actorUserId;
            }
        }

        var voucher = (request.DisbursementVoucher ?? request.ExternalInvoiceNumber ?? "").Trim();
        if (voucher.Length == 0)
            return (null, "رقم سند الصرف مطلوب.");

        var transferRef = (request.TransferReference ?? "").Trim();
        if (transferRef.Length == 0)
            return (null, "مرجع التحويل مطلوب.");

        if (!Guid.TryParse(request.TransferReceiptAttachmentId, out var receiptId))
            return (null, "إيصال التحويل (مرفق) مطلوب.");

        var receiptExists = await _attachments.ExistsAsync(receiptId, cancellationToken);
        if (!receiptExists)
            return (null, "مرفق إيصال التحويل غير موجود.");

        var voucherTaken = await _db.PartyBillingStatements.AsNoTracking().AnyAsync(
            s => s.Id != statementId
                && s.DisbursementVoucher != null
                && s.DisbursementVoucher == voucher,
            cancellationToken);
        if (voucherTaken)
            return (null, "رقم سند الصرف مُستخدم مسبقاً — لا صرف مزدوج.");

        var receiptRef = string.IsNullOrWhiteSpace(request.TransferReceiptRef)
            ? null
            : request.TransferReceiptRef.Trim();

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
        statement.ExternalInvoiceNumber = isVendor
            ? (statement.VendorInvoiceNumber ?? voucher)
            : voucher;
        statement.PaidAtUtc = paidAt;
        if (!string.IsNullOrWhiteSpace(request.Notes))
            statement.Notes = request.Notes.Trim();

        foreach (var ledger in ledgers)
        {
            var fromStatus = ledger.BillingStatus;
            ledger.BillingStatus = InspectorFeeBillingStatus.Disbursed;
            ledger.DisbursementVoucher = voucher;
            ledger.UpdatedAtUtc = now;
            _db.InspectorFeeTransitions.Add(new InspectorFeeTransition
            {
                Id = Guid.NewGuid(),
                WorkflowTaskId = ledger.WorkflowTaskId,
                FromStatus = fromStatus,
                ToStatus = InspectorFeeBillingStatus.Disbursed,
                Reason = $"صرف موثَّق — سند {voucher}",
                ActorUserId = actorUserId,
                CreatedAtUtc = now,
            });
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
        var taskIds = ParseTaskIds(request.WorkflowTaskIds);
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
            if (ledger is null)
            {
                failed.Add(new InspectorFeeTransitionErrorDto
                {
                    WorkflowTaskId = taskId.ToString(),
                    Error = "البند غير موجود.",
                });
                continue;
            }

            if (!statementTaskIdSet.Contains(taskId))
            {
                failed.Add(new InspectorFeeTransitionErrorDto
                {
                    WorkflowTaskId = taskId.ToString(),
                    Error = "الترحيل لمسار صرف المستحقين فقط.",
                });
                continue;
            }

            if (ledger.BillingStatus != InspectorFeeBillingStatus.AtFinance)
            {
                failed.Add(new InspectorFeeTransitionErrorDto
                {
                    WorkflowTaskId = taskId.ToString(),
                    Error = "لا يمكن ترحيل إلا البنود الجاهزة للصرف.",
                });
                continue;
            }

            ledger.BillingStatus = InspectorFeeBillingStatus.Deferred;
            ledger.UpdatedAtUtc = now;
            _db.InspectorFeeTransitions.Add(new InspectorFeeTransition
            {
                Id = Guid.NewGuid(),
                WorkflowTaskId = ledger.WorkflowTaskId,
                FromStatus = InspectorFeeBillingStatus.AtFinance,
                ToStatus = InspectorFeeBillingStatus.Deferred,
                Reason = "ترحيل بقرار المحاسب",
                ActorUserId = actorUserId,
                CreatedAtUtc = now,
            });
            succeeded.Add(ToReadyDto(ledger, labels, kindByTask.GetValueOrDefault(taskId)));
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

        var monthStart = new DateTime(_time.UtcNow().Year, _time.UtcNow().Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var created = new List<PartyBillingStatementDto>();
        var linesIncluded = 0;

        foreach (var group in vendorReady)
        {
            var hasOpen = await _db.PartyBillingStatements.AsNoTracking().AnyAsync(
                s => s.AssigneeId == group.Key
                    && s.PayeeType == PartyBillingPayeeType.Vendor
                    && s.CreatedAtUtc >= monthStart
                    && (s.Status == PartyBillingStatementStatus.Draft
                        || s.Status == PartyBillingStatementStatus.Issued
                        || s.Status == PartyBillingStatementStatus.InvoiceReceived),
                cancellationToken);
            if (hasOpen) continue;

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

    public async Task<(PartyBillingStatementDto? Statement, string? Error)> SubmitVendorInvoiceAsync(
        Guid statementId,
        SubmitVendorInvoiceRequest request,
        string actorUserId,
        CancellationToken cancellationToken = default)
    {
        var statement = await _db.PartyBillingStatements
            .FirstOrDefaultAsync(s => s.Id == statementId, cancellationToken);
        if (statement is null)
            return (null, "مسير الصرف غير موجود.");
        if (statement.PayeeType != PartyBillingPayeeType.Vendor)
            return (null, "رفع الفاتورة للمورّدين فقط.");
        if (statement.Status != PartyBillingStatementStatus.Issued)
            return (null, "لا تُرفع فاتورة إلا على مسير أُرسل للمكتب.");

        var invoiceNo = (request.InvoiceNumber ?? "").Trim();
        if (invoiceNo.Length == 0)
            return (null, "رقم الفاتورة مطلوب.");
        if (!Guid.TryParse(request.AttachmentId, out var attachmentId))
            return (null, "مرفق PDF الفاتورة مطلوب.");

        var exists = await _attachments.ExistsAsync(attachmentId, cancellationToken);
        if (!exists)
            return (null, "مرفق الفاتورة غير موجود.");

        var now = _time.UtcNow();
        statement.Status = PartyBillingStatementStatus.InvoiceReceived;
        statement.VendorInvoiceNumber = invoiceNo;
        statement.VendorInvoiceDate = request.InvoiceDate?.ToUniversalTime() ?? now.Date;
        statement.VendorInvoiceAttachmentId = attachmentId;
        statement.VendorInvoiceSubmittedAtUtc = now;
        statement.VendorInvoiceSubmittedByUserId = actorUserId;
        statement.VendorInvoiceMatchedAtUtc = null;
        statement.VendorInvoiceMatchedByUserId = null;
        statement.ExternalInvoiceNumber = invoiceNo;

        await _db.SaveChangesAsync(cancellationToken);

        var supervisors = await _recipients.ResolveUserIdsWithPrototypeRoleAsync(
            "financial-officer",
            cancellationToken);
        if (supervisors.Count == 0)
        {
            supervisors = await _recipients.ResolveUserIdsWithPrototypeRoleAsync(
                "section-supervisor",
                cancellationToken);
        }
        if (supervisors.Count > 0)
        {
            await _notifications.CreateForUsersAsync(
                supervisors,
                new CreateUserNotificationRequest
                {
                    Title = "فاتورة مورّد واردة",
                    Body = $"{statement.ReferenceNumber} — فاتورة {invoiceNo} بمبلغ مقفل {statement.TotalNetSar:0.##} ر.س",
                    Category = "financial",
                    Tone = "info",
                    Href = $"/financial?area=costs&section=statements&statement={statement.Id}&party={Uri.EscapeDataString(statement.AssigneeId ?? "")}",
                },
                cancellationToken);
        }

        return (await GetStatementAsync(statementId, cancellationToken), null);
    }

    public async Task<(PartyBillingStatementDto? Statement, string? Error)> MatchVendorInvoiceAsync(
        Guid statementId,
        string actorUserId,
        CancellationToken cancellationToken = default)
    {
        var statement = await _db.PartyBillingStatements
            .FirstOrDefaultAsync(s => s.Id == statementId, cancellationToken);
        if (statement is null)
            return (null, "مسير الصرف غير موجود.");
        if (statement.PayeeType != PartyBillingPayeeType.Vendor)
            return (null, "المطابقة للمورّدين فقط.");
        if (statement.Status != PartyBillingStatementStatus.InvoiceReceived)
            return (null, "لا مطابقة إلا بعد ورود فاتورة.");
        if (string.IsNullOrWhiteSpace(statement.VendorInvoiceNumber)
            || statement.VendorInvoiceAttachmentId is null)
            return (null, "بيانات الفاتورة ناقصة.");

        statement.VendorInvoiceMatchedAtUtc = _time.UtcNow();
        statement.VendorInvoiceMatchedByUserId = actorUserId;
        await _db.SaveChangesAsync(cancellationToken);
        return (await GetStatementAsync(statementId, cancellationToken), null);
    }

    public async Task<(PartyBillingStatementDto? Statement, string? Error)> RejectVendorInvoiceAsync(
        Guid statementId,
        RejectVendorInvoiceRequest request,
        string actorUserId,
        CancellationToken cancellationToken = default)
    {
        var statement = await _db.PartyBillingStatements
            .FirstOrDefaultAsync(s => s.Id == statementId, cancellationToken);
        if (statement is null)
            return (null, "مسير الصرف غير موجود.");
        if (statement.PayeeType != PartyBillingPayeeType.Vendor)
            return (null, "إعادة الفاتورة للمورّدين فقط.");
        if (statement.Status != PartyBillingStatementStatus.InvoiceReceived)
            return (null, "لا إعادة إلا لفاتورة واردة.");

        var reason = (request.Reason ?? "").Trim();
        if (reason.Length < 3)
            return (null, "سبب الإعادة للتصحيح إلزامي.");

        var rejected = ParseRejected(statement.RejectedInvoicesJson);
        rejected.Add(new PartyBillingRejectedInvoiceDto
        {
            InvoiceNumber = statement.VendorInvoiceNumber ?? "",
            InvoiceDate = statement.VendorInvoiceDate,
            AttachmentId = statement.VendorInvoiceAttachmentId?.ToString(),
            Reason = reason,
            RejectedByUserId = actorUserId,
            RejectedAtUtc = _time.UtcNow(),
        });

        statement.RejectedInvoicesJson = SerializeRejected(rejected);
        statement.VendorInvoiceNumber = null;
        statement.VendorInvoiceDate = null;
        statement.VendorInvoiceAttachmentId = null;
        statement.VendorInvoiceSubmittedAtUtc = null;
        statement.VendorInvoiceSubmittedByUserId = null;
        statement.VendorInvoiceMatchedAtUtc = null;
        statement.VendorInvoiceMatchedByUserId = null;
        statement.ExternalInvoiceNumber = null;
        statement.Status = PartyBillingStatementStatus.Issued;

        await _db.SaveChangesAsync(cancellationToken);

        return (await GetStatementAsync(statementId, cancellationToken), null);
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
        if (statement.Status is PartyBillingStatementStatus.Closed or PartyBillingStatementStatus.Cancelled)
            return (null, "لا يمكن إلغاء مستند مغلق أو ملغى.");
        if (statement.Status == PartyBillingStatementStatus.InvoiceReceived
            && statement.VendorInvoiceMatchedAtUtc is not null)
            return (null, "لا يُلغى مسير بعد مطابقة فاتورة — استخدم الإعادة أو أكمل الصرف.");

        var reason = (request.Reason ?? "").Trim();
        if (reason.Length < 3)
            return (null, "سبب الإلغاء إلزامي.");

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
            _db.InspectorFeeTransitions.Add(new InspectorFeeTransition
            {
                Id = Guid.NewGuid(),
                WorkflowTaskId = ledger.WorkflowTaskId,
                FromStatus = from,
                ToStatus = InspectorFeeBillingStatus.AtFinance,
                Reason = $"إلغاء {statement.ReferenceNumber}: {reason}",
                ActorUserId = actorUserId,
                CreatedAtUtc = now,
            });
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
        var chargeById = chargeRows.ToDictionary(c => c.Id);

 // Twin ledgers share WorkflowTaskId; pick by statement binding when available.
        static InspectorFeeLedger? ResolveLedger(
            Guid statementId,
            Guid workflowTaskId,
            IReadOnlyList<InspectorFeeLedger> rows)
        {
            var forTask = rows.Where(l => l.WorkflowTaskId == workflowTaskId).ToList();
            if (forTask.Count == 0) return null;
            var bound = forTask.FirstOrDefault(l => l.PartyBillingStatementId == statementId);
            if (bound is not null) return bound;
            return CollapseReadyLedgers(forTask).FirstOrDefault();
        }

        var propertyIds = ledgerRows
            .Where(l => l.PropertyId.HasValue)
            .Select(l => l.PropertyId!.Value)
            .Distinct()
            .ToList();
        var labels = await LoadPropertyLabelsAsync(propertyIds, cancellationToken);

        var linesByStatement = lines.GroupBy(l => l.StatementId)
            .ToDictionary(g => g.Key, g => g.ToList());

        return statements.Select(s =>
        {
            var stmtLines = linesByStatement.GetValueOrDefault(s.Id) ?? [];
            return new PartyBillingStatementDto
            {
                Id = s.Id.ToString(),
                ReferenceNumber = s.ReferenceNumber,
                AssigneeId = s.AssigneeId,
                PayeeType = string.IsNullOrWhiteSpace(s.PayeeType)
                    ? PartyBillingPayeeType.Vendor
                    : s.PayeeType,
                PayeeTypeLabel = PartyBillingPayeeType.Label(s.PayeeType),
                TaskKind = s.TaskKind,
                Status = s.Status,
                StatusLabel = PartyBillingStatementStatus.Label(s.Status),
                TotalNetSar = s.TotalNetSar,
                CreatedByUserId = s.CreatedByUserId,
                CreatedAtUtc = s.CreatedAtUtc,
                IssuedAtUtc = s.IssuedAtUtc,
                ClosedAtUtc = s.ClosedAtUtc,
                ExternalInvoiceNumber = s.ExternalInvoiceNumber,
                TransferReceiptAttachmentId = s.TransferReceiptAttachmentId?.ToString(),
                TransferReceiptRef = s.TransferReceiptRef,
                TransferReference = s.TransferReference,
                DisbursementVoucher = s.DisbursementVoucher,
                PaidAtUtc = s.PaidAtUtc,
                Notes = s.Notes,
                VendorInvoiceNumber = s.VendorInvoiceNumber,
                VendorInvoiceDate = s.VendorInvoiceDate,
                VendorInvoiceAttachmentId = s.VendorInvoiceAttachmentId?.ToString(),
                VendorInvoiceSubmittedAtUtc = s.VendorInvoiceSubmittedAtUtc,
                VendorInvoiceMatched = s.VendorInvoiceMatchedAtUtc.HasValue,
                VendorInvoiceMatchedAtUtc = s.VendorInvoiceMatchedAtUtc,
                RejectedInvoices = ParseRejected(s.RejectedInvoicesJson),
                CancelledAtUtc = s.CancelledAtUtc,
                CancelReason = s.CancelReason,
                Lines = stmtLines.Select(line =>
                {
                    if (chargeById.TryGetValue(line.WorkflowTaskId, out var charge))
                    {
                        var chargeStatus = charge.Status == CourtVisitFeeStatuses.Settled
                            || s.Status == PartyBillingStatementStatus.Closed
                            ? InspectorFeeBillingStatus.Disbursed
                            : s.Status == PartyBillingStatementStatus.Cancelled
                                ? InspectorFeeBillingStatus.AtFinance
                                : InspectorFeeBillingStatus.InStatement;
                        return new PartyBillingStatementLineDto
                        {
                            Id = line.Id.ToString(),
                            WorkflowTaskId = line.WorkflowTaskId.ToString(),
                            PropertyId = null,
                            PropertyLabel = string.IsNullOrWhiteSpace(charge.TaskDisplayId)
                                ? "زيارة محكمة"
                                : charge.TaskDisplayId.Trim(),
                            PoNumber = charge.PoNumber ?? "",
                            NetFeeSar = line.NetFeeSar,
                            BillingStatus = chargeStatus,
                            BillingStatusLabel = InspectorFeeBillingRules.StatusLabel(chargeStatus),
                        };
                    }

                    var ledger = ResolveLedger(s.Id, line.WorkflowTaskId, ledgerRows);
                    var status = ledger?.BillingStatus ?? InspectorFeeBillingStatus.InStatement;
                    return new PartyBillingStatementLineDto
                    {
                        Id = line.Id.ToString(),
                        WorkflowTaskId = line.WorkflowTaskId.ToString(),
                        PropertyId = ledger?.PropertyId?.ToString(),
                        PropertyLabel = ledger?.PropertyId is { } pid
                            && labels.TryGetValue(pid, out var label)
                            ? label
                            : ledger?.PropertyOrdinal.ToString() ?? "—",
                        PoNumber = ledger?.PoNumber ?? "",
                        NetFeeSar = line.NetFeeSar,
                        BillingStatus = status,
                        BillingStatusLabel = InspectorFeeBillingRules.StatusLabel(status),
                    };
                }).ToList(),
            };
        }).ToList();
    }

    private async Task<Dictionary<Guid, string>> LoadPropertyLabelsAsync(
        IReadOnlyList<Guid> propertyIds,
        CancellationToken cancellationToken)
    {
        if (propertyIds.Count == 0) return new Dictionary<Guid, string>();

        var snapshots = await _lookup.ListPropertiesByIdsAsync(propertyIds, cancellationToken);
        var properties = snapshots.ToList();

        var result = new Dictionary<Guid, string>();
        foreach (var property in properties)
        {
            var slot = string.IsNullOrWhiteSpace(property.RequestNumber)
                ? (string.IsNullOrWhiteSpace(property.DeedNumber)
                    ? property.Id.ToString()[..8]
                    : property.DeedNumber.Trim())
                : property.RequestNumber.Trim();
            var district = property.District?.Trim() ?? "";
            result[property.Id] = string.IsNullOrEmpty(district)
                ? slot
                : $"{slot} — {district}";
        }

        return result;
    }

    private static PartyBillingReadyLineDto ToReadyDto(
        InspectorFeeLedger ledger,
        IReadOnlyDictionary<Guid, string> labels,
        WorkflowTaskKind? kind)
    {
        var discount = Math.Max(0m, ledger.SupervisorDiscountSar);
        var resolved = kind ?? WorkflowTaskKind.EngineeringSurvey;
        var payeeType = PartyBillingPayeeType.FromTaskKind(resolved);
        return new PartyBillingReadyLineDto
        {
            WorkflowTaskId = ledger.WorkflowTaskId.ToString(),
            PropertyId = ledger.PropertyId?.ToString(),
            PropertyLabel = ledger.PropertyId is { } pid && labels.TryGetValue(pid, out var label)
                ? label
                : ledger.PropertyOrdinal.ToString(),
            PoNumber = ledger.PoNumber,
            AssigneeId = ledger.AssigneeId,
            TaskKind = resolved.ToDbValue(),
            PayeeType = payeeType,
            PayeeTypeLabel = PartyBillingPayeeType.Label(payeeType),
            AgreedFeeSar = ledger.AgreedFeeSar,
            SupervisorDiscountSar = discount,
            NetFeeSar = InspectorFeeRules.NetFee(ledger.AgreedFeeSar, discount),
            BillingStatus = ledger.BillingStatus,
            BillingStatusLabel = InspectorFeeBillingRules.StatusLabel(ledger.BillingStatus),
            AccruedAtUtc = ledger.AccruedAtUtc,
            UpdatedAtUtc = ledger.UpdatedAtUtc,
        };
    }

    private static PartyBillingReadyLineDto ToCourtVisitReadyDto(CourtVisitFeeCharge charge)
    {
        var label = string.IsNullOrWhiteSpace(charge.TaskDisplayId)
            ? "زيارة محكمة"
            : charge.TaskDisplayId.Trim();
        if (!string.IsNullOrWhiteSpace(charge.CreditAssigneeName))
            label = $"{label} — {charge.CreditAssigneeName.Trim()}";

        return new PartyBillingReadyLineDto
        {
            WorkflowTaskId = charge.Id.ToString(),
            PropertyId = null,
            PropertyLabel = label,
            PoNumber = charge.PoNumber ?? "",
            AssigneeId = charge.CreditAssigneeId,
            TaskKind = CourtVisitTaskKind,
            PayeeType = PartyBillingPayeeType.Individual,
            PayeeTypeLabel = PartyBillingPayeeType.Label(PartyBillingPayeeType.Individual),
            AgreedFeeSar = charge.AmountSar,
            SupervisorDiscountSar = 0m,
            NetFeeSar = charge.AmountSar,
            BillingStatus = InspectorFeeBillingStatus.AtFinance,
            BillingStatusLabel = InspectorFeeBillingRules.StatusLabel(InspectorFeeBillingStatus.AtFinance),
            AccruedAtUtc = charge.CreatedAtUtc,
            UpdatedAtUtc = charge.UpdatedAtUtc,
        };
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
        if (alreadyLined.Count > 0)
        {
            return new CreatePartyBillingStatementResponseDto
            {
                Error = "أحد بنود زيارة المحكمة مُدرج مسبقاً في مسير صرف (مدفوع أو قائم).",
            };
        }

        var assignees = charges
            .Select(c => c.CreditAssigneeId?.Trim() ?? "")
            .Where(a => a.Length > 0)
            .Distinct(StringComparer.Ordinal)
            .ToList();
        if (assignees.Count != 1)
        {
            return new CreatePartyBillingStatementResponseDto
            {
                Error = "يجب أن تكون كل بنود زيارة المحكمة لنفس المستحق.",
            };
        }

        var assigneeId = assignees[0];
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
            Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim(),
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

    private static List<PartyBillingRejectedInvoiceDto> ParseRejected(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return [];
        try
        {
            return System.Text.Json.JsonSerializer.Deserialize<List<PartyBillingRejectedInvoiceDto>>(json)
                ?? [];
        }
        catch (System.Text.Json.JsonException)
        {
            return [];
        }
    }

    private static string? SerializeRejected(IReadOnlyList<PartyBillingRejectedInvoiceDto> items)
    {
        if (items.Count == 0) return null;
        return System.Text.Json.JsonSerializer.Serialize(items);
    }

    private static List<Guid> ParseTaskIds(IReadOnlyList<string> raw) =>
        raw.Select(id => Guid.TryParse(id, out var g) ? g : (Guid?)null)
            .Where(g => g.HasValue)
            .Select(g => g!.Value)
            .Distinct()
            .ToList();

 /// <summary>
 /// Keeps one ledger per workflow-task + property/deed so legacy reassignment twins
 /// (same task+property, different <see cref="InspectorFeeLedger.UserId"/>) do not
 /// duplicate ready lines or break statement creation counts.
 /// Prefers rows where UserId matches AssigneeId, then newest update.
 /// </summary>
    internal static IEnumerable<InspectorFeeLedger> CollapseReadyLedgers(
        IEnumerable<InspectorFeeLedger> ledgers) =>
        ledgers
            .GroupBy(l => (
                l.WorkflowTaskId,
                PropertyKey: l.PropertyId
                    ?? (l.DeedId == Guid.Empty ? l.Id : l.DeedId)))
            .Select(g => g
                .OrderByDescending(l =>
                    !string.IsNullOrWhiteSpace(l.AssigneeId)
                    && string.Equals(
                        l.UserId?.Trim(),
                        l.AssigneeId.Trim(),
                        StringComparison.Ordinal)
                        ? 1
                        : 0)
                .ThenByDescending(l => l.UpdatedAtUtc)
                .ThenByDescending(l => l.CreatedAtUtc)
                .First());

    private async Task<string> NextReferenceAsync(
        DateTime nowUtc,
        CancellationToken cancellationToken)
    {
        var dateKey = nowUtc.ToString("yyMMdd");
        var (reference, error) = await _commands.AllocateDocumentReferenceAsync(
            RefDept, RefType, dateKey, cancellationToken);
        if (error is not null)
            throw new InvalidOperationException(error);
        if (string.IsNullOrWhiteSpace(reference))
            throw new InvalidOperationException("تعذّر توليد رقم كشف الفوترة.");
        return reference;
    }

    private async Task NotifyStatementIssuedAsync(
        PartyBillingStatement statement,
        int lineCount,
        CancellationToken cancellationToken)
    {
        var supervisors = await _recipients.ResolveUserIdsWithPrototypeRoleAsync(
            "section-supervisor",
            cancellationToken);
        if (supervisors.Count > 0)
        {
            await _notifications.CreateForUsersAsync(
                supervisors,
                new CreateUserNotificationRequest
                {
                    Title = "إصدار كشف فوترة مكتب هندسي",
                    Body = $"صدر الكشف {statement.ReferenceNumber} ({lineCount} بند) — للاطلاع.",
                    Tone = "info",
                    Href = "/party-fees?variant=engineering-survey",
                    Category = "financial",
                    SourceEvent = $"eng-billing-issued:{statement.Id}",
                },
                cancellationToken);
        }

        var officeUserId = await _recipients.ResolveUserIdForDistributionAssigneeAsync(
            statement.AssigneeId,
            cancellationToken);
        if (officeUserId is not null)
        {
            await _notifications.CreateForUserAsync(
                officeUserId,
                new CreateUserNotificationRequest
                {
                    Title = "كشف فوترة صادر",
                    Body = $"وصلك الكشف {statement.ReferenceNumber} للاطلاع ({lineCount} بند).",
                    Tone = "info",
                    Href = "/party-fees?variant=engineering-survey",
                    Category = "financial",
                    SourceEvent = $"eng-billing-issued-office:{statement.Id}",
                },
                cancellationToken);
        }
    }

    private async Task NotifyStatementClosedAsync(
        PartyBillingStatement statement,
        int lineCount,
        CancellationToken cancellationToken)
    {
        var officeUserId = await _recipients.ResolveUserIdForDistributionAssigneeAsync(
            statement.AssigneeId,
            cancellationToken);
        if (officeUserId is null) return;

        await _notifications.CreateForUserAsync(
            officeUserId,
            new CreateUserNotificationRequest
            {
                Title = "تم صرف كشف الفوترة",
                Body = $"أُقفل الكشف {statement.ReferenceNumber} كمصروف ({lineCount} بند).",
                Tone = "success",
                Href = "/party-fees?variant=engineering-survey",
                Category = "financial",
                SourceEvent = $"eng-billing-closed:{statement.Id}",
            },
            cancellationToken);
    }

    private static WorkflowTaskKind ParseKind(string? raw) =>
        WorkflowTaskKindValues.TryParse(raw, out var kind)
            || Enum.TryParse(raw, true, out kind)
            ? kind
            : WorkflowTaskKind.CaseStudyProperty;
}
