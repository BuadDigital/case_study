using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Notifications;

namespace RealEstateEval.Infrastructure.Services;

public class EngineeringBillingStatementService : IEngineeringBillingStatementService
{
    private const string RefDept = "FN";
    private const string RefType = "CS";
    private const string EngSurveyKind = "engineering-survey";

    private readonly ApplicationDbContext _db;
    private readonly INotificationService _notifications;
    private readonly NotificationRecipientResolver _recipients;

    public EngineeringBillingStatementService(
        ApplicationDbContext db,
        INotificationService notifications,
        NotificationRecipientResolver recipients)
    {
        _db = db;
        _notifications = notifications;
        _recipients = recipients;
    }

    public async Task<IReadOnlyList<EngBillingReadyLineDto>> ListReadyLinesAsync(
        string? assigneeId = null,
        CancellationToken cancellationToken = default)
    {
        var ledgers = await (
            from ledger in _db.InspectorFeeLedgers.AsNoTracking()
            join task in _db.WorkflowTasks.AsNoTracking() on ledger.WorkflowTaskId equals task.Id
            where task.Kind == EngSurveyKind
                && !ledger.ExcludedFromBatch
                && (ledger.BillingStatus == InspectorFeeBillingStatus.AtFinance
                    || ledger.BillingStatus == InspectorFeeBillingStatus.Deferred)
                && (assigneeId == null
                    || ledger.AssigneeId == assigneeId)
            orderby ledger.UpdatedAtUtc descending
            select new { ledger, task }
        ).ToListAsync(cancellationToken);

        var propertyIds = ledgers
            .Select(x => x.ledger.PropertyId)
            .Where(id => id.HasValue)
            .Select(id => id!.Value)
            .Distinct()
            .ToList();

        var labels = await LoadPropertyLabelsAsync(propertyIds, cancellationToken);

        return ledgers.Select(x => ToReadyDto(x.ledger, labels)).ToList();
    }

    public async Task<IReadOnlyList<EngBillingStatementDto>> ListStatementsAsync(
        string? assigneeId = null,
        string? status = null,
        bool issuedOrLaterOnly = false,
        CancellationToken cancellationToken = default)
    {
        var query = _db.EngineeringBillingStatements.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(assigneeId))
            query = query.Where(s => s.AssigneeId == assigneeId);

        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(s => s.Status == status);

        if (issuedOrLaterOnly)
        {
            query = query.Where(s =>
                s.Status == EngineeringBillingStatementStatus.Issued
                || s.Status == EngineeringBillingStatementStatus.Closed);
        }

        var statements = await query
            .OrderByDescending(s => s.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        if (statements.Count == 0) return [];

        var ids = statements.Select(s => s.Id).ToList();
        var lines = await _db.EngineeringBillingStatementLines.AsNoTracking()
            .Where(l => ids.Contains(l.StatementId))
            .ToListAsync(cancellationToken);

        return await MapStatementsAsync(statements, lines, cancellationToken);
    }

    public async Task<EngBillingStatementDto?> GetStatementAsync(
        Guid statementId,
        CancellationToken cancellationToken = default)
    {
        var statement = await _db.EngineeringBillingStatements.AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == statementId, cancellationToken);
        if (statement is null) return null;

        var lines = await _db.EngineeringBillingStatementLines.AsNoTracking()
            .Where(l => l.StatementId == statementId)
            .ToListAsync(cancellationToken);

        var mapped = await MapStatementsAsync([statement], lines, cancellationToken);
        return mapped.FirstOrDefault();
    }

    public async Task<CreateEngBillingStatementResult> CreateStatementAsync(
        CreateEngBillingStatementRequest request,
        string actorUserId,
        CancellationToken cancellationToken = default)
    {
        var taskIds = ParseTaskIds(request.WorkflowTaskIds);
        if (taskIds.Count == 0)
        {
            return new CreateEngBillingStatementResult
            {
                Error = "اختر بنداً واحداً على الأقل لإنشاء كشف الفوترة.",
            };
        }

        var ledgers = await _db.InspectorFeeLedgers
            .Where(l => taskIds.Contains(l.WorkflowTaskId))
            .ToListAsync(cancellationToken);

        if (ledgers.Count != taskIds.Count)
        {
            return new CreateEngBillingStatementResult
            {
                Error = "بعض البنود المحددة غير موجودة في سجل الأتعاب.",
            };
        }

        var engTaskIds = await _db.WorkflowTasks.AsNoTracking()
            .Where(t => taskIds.Contains(t.Id) && t.Kind == EngSurveyKind)
            .Select(t => t.Id)
            .ToListAsync(cancellationToken);

        if (engTaskIds.Count != taskIds.Count)
        {
            return new CreateEngBillingStatementResult
            {
                Error = "كشف الفوترة للمكتب الهندسي يقبل بنود الرفع المساحي فقط.",
            };
        }

        var assignees = ledgers
            .Select(l => l.AssigneeId?.Trim() ?? "")
            .Where(a => a.Length > 0)
            .Distinct(StringComparer.Ordinal)
            .ToList();

        if (assignees.Count != 1)
        {
            return new CreateEngBillingStatementResult
            {
                Error = "يجب أن تكون كل بنود الكشف لنفس المكتب الهندسي.",
            };
        }

        var assigneeId = assignees[0];
        foreach (var ledger in ledgers)
        {
            if (ledger.ExcludedFromBatch)
            {
                return new CreateEngBillingStatementResult
                {
                    Error = "لا يمكن إدراج بند مستبعد في كشف الفوترة.",
                };
            }

            if (!InspectorFeeBillingRules.IsReadyForEngStatement(ledger.BillingStatus))
            {
                return new CreateEngBillingStatementResult
                {
                    Error = "لا يُدرج في كشف الفوترة إلا البنود الجاهزة أو المرحَّلة.",
                };
            }

            if (ledger.EngineeringBillingStatementId.HasValue)
            {
                return new CreateEngBillingStatementResult
                {
                    Error = "أحد البنود مُدرج مسبقاً في كشف فوترة.",
                };
            }
        }

        var now = DateTime.UtcNow;
        string reference;
        try
        {
            reference = await NextReferenceAsync(now, cancellationToken);
        }
        catch (Exception ex)
        {
            return new CreateEngBillingStatementResult { Error = ex.Message };
        }

        var statementId = Guid.NewGuid();
        var total = 0m;
        var statementLines = new List<EngineeringBillingStatementLine>();

        foreach (var ledger in ledgers)
        {
            var net = InspectorFeeRules.NetFee(ledger.AgreedFeeSar, ledger.SupervisorDiscountSar);
            total += net;
            var fromStatus = ledger.BillingStatus;
            ledger.BillingStatus = InspectorFeeBillingStatus.InStatement;
            ledger.EngineeringBillingStatementId = statementId;
            ledger.UpdatedAtUtc = now;

            statementLines.Add(new EngineeringBillingStatementLine
            {
                Id = Guid.NewGuid(),
                StatementId = statementId,
                WorkflowTaskId = ledger.WorkflowTaskId,
                NetFeeSar = net,
            });

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

        var deferredDtos = new List<EngBillingReadyLineDto>();
        if (request.DeferUnselectedForAssignee)
        {
            var selectedSet = taskIds.ToHashSet();
            var unselected = await _db.InspectorFeeLedgers
                .Where(l =>
                    l.AssigneeId == assigneeId
                    && l.BillingStatus == InspectorFeeBillingStatus.AtFinance
                    && !l.ExcludedFromBatch
                    && !selectedSet.Contains(l.WorkflowTaskId)
                    && !l.EngineeringBillingStatementId.HasValue)
                .ToListAsync(cancellationToken);

            var unselectedIds = unselected.Select(l => l.WorkflowTaskId).ToList();
            if (unselectedIds.Count > 0)
            {
                var engUnselected = (await _db.WorkflowTasks.AsNoTracking()
                    .Where(t => unselectedIds.Contains(t.Id) && t.Kind == EngSurveyKind)
                    .Select(t => t.Id)
                    .ToListAsync(cancellationToken)).ToHashSet();

                var propertyIds = unselected
                    .Where(l => engUnselected.Contains(l.WorkflowTaskId) && l.PropertyId.HasValue)
                    .Select(l => l.PropertyId!.Value)
                    .Distinct()
                    .ToList();
                var labels = await LoadPropertyLabelsAsync(propertyIds, cancellationToken);

                foreach (var ledger in unselected.Where(l => engUnselected.Contains(l.WorkflowTaskId)))
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
                    deferredDtos.Add(ToReadyDto(ledger, labels));
                }
            }
        }

        _db.EngineeringBillingStatements.Add(new EngineeringBillingStatement
        {
            Id = statementId,
            ReferenceNumber = reference,
            AssigneeId = assigneeId,
            Status = EngineeringBillingStatementStatus.Draft,
            TotalNetSar = total,
            CreatedByUserId = actorUserId,
            CreatedAtUtc = now,
            Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim(),
            Lines = statementLines,
        });

        await _db.SaveChangesAsync(cancellationToken);

        var dto = await GetStatementAsync(statementId, cancellationToken);
        return new CreateEngBillingStatementResult
        {
            Statement = dto,
            DeferredLines = deferredDtos,
        };
    }

    public async Task<(EngBillingStatementDto? Statement, string? Error)> IssueStatementAsync(
        Guid statementId,
        string actorUserId,
        CancellationToken cancellationToken = default)
    {
        var statement = await _db.EngineeringBillingStatements
            .FirstOrDefaultAsync(s => s.Id == statementId, cancellationToken);
        if (statement is null)
            return (null, "كشف الفوترة غير موجود.");

        if (statement.Status != EngineeringBillingStatementStatus.Draft)
            return (null, "لا يمكن إرسال إلا كشوف المسودة.");

        var lineCount = await _db.EngineeringBillingStatementLines
            .CountAsync(l => l.StatementId == statementId, cancellationToken);
        if (lineCount == 0)
            return (null, "لا يمكن إرسال كشف بلا بنود.");

        var now = DateTime.UtcNow;
        statement.Status = EngineeringBillingStatementStatus.Issued;
        statement.IssuedAtUtc = now;
        statement.IssuedByUserId = actorUserId;

        await _db.SaveChangesAsync(cancellationToken);
        await NotifyStatementIssuedAsync(statement, lineCount, cancellationToken);

        var dto = await GetStatementAsync(statementId, cancellationToken);
        return (dto, null);
    }

    public async Task<(EngBillingStatementDto? Statement, string? Error)> CloseStatementAsync(
        Guid statementId,
        CloseEngBillingStatementRequest request,
        string actorUserId,
        CancellationToken cancellationToken = default)
    {
        var statement = await _db.EngineeringBillingStatements
            .FirstOrDefaultAsync(s => s.Id == statementId, cancellationToken);
        if (statement is null)
            return (null, "كشف الفوترة غير موجود.");

        if (statement.Status != EngineeringBillingStatementStatus.Issued)
            return (null, "لا يمكن إقفال إلا كشف صادر مرسل للمكتب.");

        var invoice = (request.ExternalInvoiceNumber ?? "").Trim();
        if (invoice.Length == 0)
            return (null, "رقم الفاتورة من البرنامج المحاسبي مطلوب.");

        Guid? receiptId = null;
        if (!string.IsNullOrWhiteSpace(request.TransferReceiptAttachmentId)
            && Guid.TryParse(request.TransferReceiptAttachmentId, out var parsedReceipt))
        {
            receiptId = parsedReceipt;
        }

        var receiptRef = string.IsNullOrWhiteSpace(request.TransferReceiptRef)
            ? null
            : request.TransferReceiptRef.Trim();

        if (receiptId is null && string.IsNullOrWhiteSpace(receiptRef))
            return (null, "إيصال التحويل مطلوب (مرفق أو مرجع).");

        if (receiptId.HasValue)
        {
            var exists = await _db.FileAttachments.AsNoTracking()
                .AnyAsync(a => a.Id == receiptId.Value, cancellationToken);
            if (!exists)
                return (null, "مرفق إيصال التحويل غير موجود.");
        }

        var lines = await _db.EngineeringBillingStatementLines
            .Where(l => l.StatementId == statementId)
            .ToListAsync(cancellationToken);
        var taskIds = lines.Select(l => l.WorkflowTaskId).ToList();
        var ledgers = await _db.InspectorFeeLedgers
            .Where(l => taskIds.Contains(l.WorkflowTaskId))
            .ToListAsync(cancellationToken);

        var now = DateTime.UtcNow;
        var paidAt = request.PaidAtUtc?.ToUniversalTime() ?? now;

        statement.Status = EngineeringBillingStatementStatus.Closed;
        statement.ClosedAtUtc = now;
        statement.ClosedByUserId = actorUserId;
        statement.ExternalInvoiceNumber = invoice;
        statement.TransferReceiptAttachmentId = receiptId;
        statement.TransferReceiptRef = receiptRef;
        statement.PaidAtUtc = paidAt;
        if (!string.IsNullOrWhiteSpace(request.Notes))
            statement.Notes = request.Notes.Trim();

        foreach (var ledger in ledgers)
        {
            var fromStatus = ledger.BillingStatus;
            ledger.BillingStatus = InspectorFeeBillingStatus.Disbursed;
            ledger.DisbursementVoucher = invoice;
            ledger.UpdatedAtUtc = now;
            _db.InspectorFeeTransitions.Add(new InspectorFeeTransition
            {
                Id = Guid.NewGuid(),
                WorkflowTaskId = ledger.WorkflowTaskId,
                FromStatus = fromStatus,
                ToStatus = InspectorFeeBillingStatus.Disbursed,
                Reason = $"صرف موثَّق — فاتورة {invoice}",
                ActorUserId = actorUserId,
                CreatedAtUtc = now,
            });
        }

        await _db.SaveChangesAsync(cancellationToken);
        await NotifyStatementClosedAsync(statement, ledgers.Count, cancellationToken);

        var dto = await GetStatementAsync(statementId, cancellationToken);
        return (dto, null);
    }

    public async Task<DeferEngBillingLinesResult> DeferLinesAsync(
        DeferEngBillingLinesRequest request,
        string actorUserId,
        CancellationToken cancellationToken = default)
    {
        var taskIds = ParseTaskIds(request.WorkflowTaskIds);
        var succeeded = new List<EngBillingReadyLineDto>();
        var failed = new List<InspectorFeeTransitionErrorDto>();

        if (taskIds.Count == 0)
            return new DeferEngBillingLinesResult { Deferred = succeeded, Failed = failed };

        var ledgers = await _db.InspectorFeeLedgers
            .Where(l => taskIds.Contains(l.WorkflowTaskId))
            .ToListAsync(cancellationToken);

        var engIds = (await _db.WorkflowTasks.AsNoTracking()
            .Where(t => taskIds.Contains(t.Id) && t.Kind == EngSurveyKind)
            .Select(t => t.Id)
            .ToListAsync(cancellationToken)).ToHashSet();

        var propertyIds = ledgers
            .Where(l => l.PropertyId.HasValue)
            .Select(l => l.PropertyId!.Value)
            .Distinct()
            .ToList();
        var labels = await LoadPropertyLabelsAsync(propertyIds, cancellationToken);
        var now = DateTime.UtcNow;

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

            if (!engIds.Contains(taskId))
            {
                failed.Add(new InspectorFeeTransitionErrorDto
                {
                    WorkflowTaskId = taskId.ToString(),
                    Error = "الترحيل لمسار المكتب الهندسي فقط.",
                });
                continue;
            }

            if (ledger.BillingStatus != InspectorFeeBillingStatus.AtFinance)
            {
                failed.Add(new InspectorFeeTransitionErrorDto
                {
                    WorkflowTaskId = taskId.ToString(),
                    Error = "لا يمكن ترحيل إلا البنود الجاهزة للفوترة.",
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
            succeeded.Add(ToReadyDto(ledger, labels));
        }

        if (succeeded.Count > 0)
            await _db.SaveChangesAsync(cancellationToken);

        return new DeferEngBillingLinesResult { Deferred = succeeded, Failed = failed };
    }

    private async Task<IReadOnlyList<EngBillingStatementDto>> MapStatementsAsync(
        IReadOnlyList<EngineeringBillingStatement> statements,
        IReadOnlyList<EngineeringBillingStatementLine> lines,
        CancellationToken cancellationToken)
    {
        var taskIds = lines.Select(l => l.WorkflowTaskId).Distinct().ToList();
        var ledgers = await _db.InspectorFeeLedgers.AsNoTracking()
            .Where(l => taskIds.Contains(l.WorkflowTaskId))
            .ToDictionaryAsync(l => l.WorkflowTaskId, cancellationToken);

        var propertyIds = ledgers.Values
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
            return new EngBillingStatementDto
            {
                Id = s.Id.ToString(),
                ReferenceNumber = s.ReferenceNumber,
                AssigneeId = s.AssigneeId,
                Status = s.Status,
                StatusLabel = EngineeringBillingStatementStatus.Label(s.Status),
                TotalNetSar = s.TotalNetSar,
                CreatedByUserId = s.CreatedByUserId,
                CreatedAtUtc = s.CreatedAtUtc,
                IssuedAtUtc = s.IssuedAtUtc,
                ClosedAtUtc = s.ClosedAtUtc,
                ExternalInvoiceNumber = s.ExternalInvoiceNumber,
                TransferReceiptAttachmentId = s.TransferReceiptAttachmentId?.ToString(),
                TransferReceiptRef = s.TransferReceiptRef,
                PaidAtUtc = s.PaidAtUtc,
                Notes = s.Notes,
                Lines = stmtLines.Select(line =>
                {
                    ledgers.TryGetValue(line.WorkflowTaskId, out var ledger);
                    var status = ledger?.BillingStatus ?? InspectorFeeBillingStatus.InStatement;
                    return new EngBillingStatementLineDto
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

        var properties = await _db.WorkOrderProperties.AsNoTracking()
            .Where(p => propertyIds.Contains(p.Id))
            .ToListAsync(cancellationToken);

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

    private static EngBillingReadyLineDto ToReadyDto(
        InspectorFeeLedger ledger,
        IReadOnlyDictionary<Guid, string> labels)
    {
        var discount = Math.Max(0m, ledger.SupervisorDiscountSar);
        return new EngBillingReadyLineDto
        {
            WorkflowTaskId = ledger.WorkflowTaskId.ToString(),
            PropertyId = ledger.PropertyId?.ToString(),
            PropertyLabel = ledger.PropertyId is { } pid && labels.TryGetValue(pid, out var label)
                ? label
                : ledger.PropertyOrdinal.ToString(),
            PoNumber = ledger.PoNumber,
            AssigneeId = ledger.AssigneeId,
            AgreedFeeSar = ledger.AgreedFeeSar,
            SupervisorDiscountSar = discount,
            NetFeeSar = InspectorFeeRules.NetFee(ledger.AgreedFeeSar, discount),
            BillingStatus = ledger.BillingStatus,
            BillingStatusLabel = InspectorFeeBillingRules.StatusLabel(ledger.BillingStatus),
            AccruedAtUtc = ledger.AccruedAtUtc,
            UpdatedAtUtc = ledger.UpdatedAtUtc,
        };
    }

    private static List<Guid> ParseTaskIds(IReadOnlyList<string> raw) =>
        raw.Select(id => Guid.TryParse(id, out var g) ? g : (Guid?)null)
            .Where(g => g.HasValue)
            .Select(g => g!.Value)
            .Distinct()
            .ToList();

    private async Task<string> NextReferenceAsync(
        DateTime nowUtc,
        CancellationToken cancellationToken)
    {
        var dateKey = nowUtc.ToString("yyMMdd");

        if (_db.Database.IsNpgsql())
        {
            var id = Guid.NewGuid();
            var rows = await _db.Database
                .SqlQueryRaw<int>(
                    """
                    INSERT INTO case_study."DocumentReferenceCounters"
                        ("Id", "Dept", "Type", "DateKey", "Seq", "UpdatedAtUtc")
                    VALUES ({0}, {1}, {2}, {3}, 1, {4})
                    ON CONFLICT ("Dept", "Type", "DateKey")
                    DO UPDATE SET
                        "Seq" = case_study."DocumentReferenceCounters"."Seq" + 1,
                        "UpdatedAtUtc" = EXCLUDED."UpdatedAtUtc"
                    RETURNING "Seq"
                    """,
                    id,
                    RefDept,
                    RefType,
                    dateKey,
                    nowUtc)
                .ToListAsync(cancellationToken);

            var seq = rows.FirstOrDefault();
            if (seq <= 0)
                throw new InvalidOperationException("تعذّر توليد رقم كشف الفوترة.");
            if (seq > 999)
                throw new InvalidOperationException("تجاوز عدّاد كشوف الفوترة اليومي الحد الأقصى (999).");
            return $"{RefDept}-{RefType}-{dateKey}-{seq:D3}";
        }

        var counter = await _db.DocumentReferenceCounters
            .FirstOrDefaultAsync(
                c => c.Dept == RefDept && c.Type == RefType && c.DateKey == dateKey,
                cancellationToken);

        if (counter is null)
        {
            counter = new DocumentReferenceCounter
            {
                Id = Guid.NewGuid(),
                Dept = RefDept,
                Type = RefType,
                DateKey = dateKey,
                Seq = 1,
                UpdatedAtUtc = nowUtc,
            };
            _db.DocumentReferenceCounters.Add(counter);
        }
        else
        {
            if (counter.Seq >= 999)
                throw new InvalidOperationException("تجاوز عدّاد كشوف الفوترة اليومي الحد الأقصى (999).");
            counter.Seq += 1;
            counter.UpdatedAtUtc = nowUtc;
        }

        return $"{RefDept}-{RefType}-{dateKey}-{counter.Seq:D3}";
    }

    private async Task NotifyStatementIssuedAsync(
        EngineeringBillingStatement statement,
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
        EngineeringBillingStatement statement,
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
}
