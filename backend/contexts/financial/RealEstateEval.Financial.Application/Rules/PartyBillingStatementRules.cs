using RealEstateEval.Application;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Financial.Domain;

namespace RealEstateEval.Financial.Application.Rules;

/// <summary>
/// Pure decision logic behind party billing statements (vendor statements / individual payment
/// orders): which ledgers may join a statement, the transition guards for issue/close/cancel,
/// and the projection of already-loaded rows into DTOs. No EF, no I/O — the service keeps the
/// queries, the SaveChanges and the notifications.
/// </summary>
public static class PartyBillingStatementRules
{
    /// <summary>Ledger-backed party fee kinds (workflow + inspector fee ledger).</summary>
    public static readonly IReadOnlySet<WorkflowTaskKind> StatementKinds =
        new HashSet<WorkflowTaskKind>
        {
            WorkflowTaskKind.FieldInspection,
            WorkflowTaskKind.GovernmentReview,
            WorkflowTaskKind.EngineeringSurvey,
        };

    /// <summary>Ops court-visit fee charges — individual payee, same statement close path.</summary>
    public const string CourtVisitTaskKind = WorkflowTaskKindValues.CourtVisit;

    /// <summary>Notes are stored trimmed, or null when the caller sent only whitespace.</summary>
    public static string? NormalizeNotes(string? notes) =>
        string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();

    /// <summary>Statement month bucket used by the automatic vendor run.</summary>
    public static DateTime MonthStart(DateTime nowUtc) =>
        new(nowUtc.Year, nowUtc.Month, 1, 0, 0, 0, DateTimeKind.Utc);

    /// <summary>
    /// Reassignment twins + multi-deed rows share one workflow task; surface a single ready
    /// row per task, newest first.
    /// </summary>
    public static List<InspectorFeeLedger> PickOneLedgerPerTask(
        IEnumerable<InspectorFeeLedger> ledgers) =>
        PartyBillingRowMapper.CollapseReadyLedgers(ledgers)
            .GroupBy(l => l.WorkflowTaskId)
            .Select(g => g
                .OrderByDescending(l => l.UpdatedAtUtc)
                .ThenByDescending(l => l.CreatedAtUtc)
                .First())
            .ToList();

    /// <summary>Ready lines are shown newest-touched first, whatever their source ledger.</summary>
    public static List<PartyBillingReadyLineDto> OrderReadyLines(
        IEnumerable<PartyBillingReadyLineDto> lines) =>
        lines
            .OrderByDescending(l => l.UpdatedAtUtc ?? l.AccruedAtUtc ?? DateTime.MinValue)
            .ToList();

    /// <summary>A court-visit charge is never mixed with ledger dues on one payment order.</summary>
    public static string? ValidateCourtVisitMix(int openChargeCount, int selectedTaskCount) =>
        openChargeCount > 0 && openChargeCount != selectedTaskCount
            ? "لا تُخلط أتعاب زيارة المحكمة مع بنود أخرى في نفس أمر الصرف."
            : null;

    /// <summary>Outcome of validating a ledger-backed statement selection.</summary>
    public sealed record LedgerStatementPlan(
        string? Error,
        IReadOnlyList<KeyValuePair<Guid, List<InspectorFeeLedger>>> Groups,
        WorkflowTaskKind StatementKind,
        string AssigneeId)
    {
        public static LedgerStatementPlan Failed(string error) => new(error, [], default, "");
    }

    /// <summary>
    /// Everything the create path can decide from already-loaded rows: the selection exists,
    /// is not billed twice, is ready, is one statement kind and one party.
    /// </summary>
    public static LedgerStatementPlan BuildLedgerStatementPlan(
        IReadOnlyList<Guid> taskIds,
        IReadOnlyList<InspectorFeeLedger> candidates,
        IReadOnlyCollection<Guid> alreadyLinedTaskIds,
        IReadOnlyDictionary<Guid, WorkflowTaskKind> taskKinds)
    {
        if (taskIds.Any(id => candidates.All(l => l.WorkflowTaskId != id)))
            return LedgerStatementPlan.Failed("بعض البنود المحددة غير موجودة في سجل الأتعاب.");

        // Unique IX on PartyBillingStatementLines.WorkflowTaskId — a task is billed once.
        if (alreadyLinedTaskIds.Count > 0)
            return LedgerStatementPlan.Failed("أحد البنود مُدرج مسبقاً في مسير صرف (مدفوع أو قائم).");

        // Ready ledgers only; twin reassignments collapse; multi-deed stays one line per task
        // (unique WorkflowTaskId) with summed net.
        var readyForSelected = candidates
            .Where(l =>
                !l.ExcludedFromBatch
                && !l.PartyBillingStatementId.HasValue
                && InspectorFeeBillingRules.IsReadyForEngStatement(l.BillingStatus))
            .ToList();
        var chosenIds = PartyBillingRowMapper.CollapseReadyLedgers(readyForSelected)
            .Select(l => l.Id)
            .ToHashSet();
        var groups = candidates
            .Where(l => chosenIds.Contains(l.Id))
            .GroupBy(l => l.WorkflowTaskId)
            .Select(g => new KeyValuePair<Guid, List<InspectorFeeLedger>>(g.Key, g.ToList()))
            .ToList();

        if (taskIds.Any(id => groups.All(g => g.Key != id)))
            return LedgerStatementPlan.Failed("لا يُدرج في كشف الفوترة إلا البنود الجاهزة أو المرحَّلة.");

        if (taskKinds.Count != taskIds.Count
            || taskKinds.Values.Any(kind => !StatementKinds.Contains(kind)))
        {
            return LedgerStatementPlan.Failed(
                "كشف الفوترة يقبل بنود المعاينة والرفع المساحي وزيارة المحكمة (وأتعاب المراجعة القديمة إن وُجدت).");
        }

        var kinds = taskKinds.Values.ToList();
        if (kinds.Distinct().Count() != 1)
            return LedgerStatementPlan.Failed("يجب أن تكون كل بنود الكشف من نفس نوع المهمة.");

        var assignees = groups
            .SelectMany(g => g.Value)
            .Select(l => l.AssigneeId?.Trim() ?? "")
            .Where(a => a.Length > 0)
            .Distinct(StringComparer.Ordinal)
            .ToList();
        if (assignees.Count != 1)
            return LedgerStatementPlan.Failed("يجب أن تكون كل بنود الكشف لنفس الطرف.");

        return new LedgerStatementPlan(null, groups, kinds[0], assignees[0]);
    }

    /// <summary>
    /// Every ledger status change on this path writes the same audit row; only the reason
    /// differs, so the reason texts live next to the factory.
    /// </summary>
    public static InspectorFeeTransition Transition(
        InspectorFeeLedger ledger,
        string fromStatus,
        string toStatus,
        string reason,
        string actorUserId,
        DateTime nowUtc) => new()
        {
            Id = Guid.NewGuid(),
            WorkflowTaskId = ledger.WorkflowTaskId,
            FromStatus = fromStatus,
            ToStatus = toStatus,
            Reason = reason,
            ActorUserId = actorUserId,
            CreatedAtUtc = nowUtc,
        };

    public static string InsertedInStatementReason(string reference) => $"إدراج في كشف {reference}";

    public static string NotInStatementDeferralReason(string reference) =>
        $"ترحيل — لم يُدرج في كشف {reference}";

    public static string DisbursedReason(string voucher) => $"صرف موثَّق — سند {voucher}";

    public const string AccountantDeferralReason = "ترحيل بقرار المحاسب";

    public static string CancelledReason(string reference, string reason) =>
        $"إلغاء {reference}: {reason}";

    /// <summary>Net payable for one statement line = sum of the task's collapsed ledgers.</summary>
    public static decimal NetForGroup(IEnumerable<InspectorFeeLedger> ledgers) =>
        ledgers.Sum(l => InspectorFeeRules.NetFee(l.AgreedFeeSar, l.SupervisorDiscountSar));

    /// <summary>Court-visit charges bill as one payment order for one payee.</summary>
    public static (string? Error, string AssigneeId) ValidateCourtVisitSelection(
        IReadOnlyList<CourtVisitFeeCharge> charges,
        IReadOnlyCollection<Guid> alreadyLinedChargeIds)
    {
        if (alreadyLinedChargeIds.Count > 0)
            return ("أحد بنود زيارة المحكمة مُدرج مسبقاً في مسير صرف (مدفوع أو قائم).", "");

        var assignees = charges
            .Select(c => c.CreditAssigneeId?.Trim() ?? "")
            .Where(a => a.Length > 0)
            .Distinct(StringComparer.Ordinal)
            .ToList();
        return assignees.Count != 1
            ? ("يجب أن تكون كل بنود زيارة المحكمة لنفس المستحق.", "")
            : (null, assignees[0]);
    }

    /// <summary>Only a draft with lines may be issued.</summary>
    public static string? ValidateIssue(string status, int lineCount)
    {
        if (status != PartyBillingStatementStatus.Draft)
            return "لا يمكن إرسال إلا المسيرات/الأوامر في حالة المسودة.";
        return lineCount == 0 ? "لا يمكن إرسال مستند بلا بنود." : null;
    }

    /// <summary>Result of the close guard: the parsed payment evidence, or an error.</summary>
    public sealed record CloseStatementCheck(
        string? Error,
        bool PromoteDraftToIssued,
        string Voucher,
        string TransferReference,
        Guid ReceiptAttachmentId,
        string? TransferReceiptRef);

    /// <summary>
    /// Close guards that need no storage: the payee-specific status gate (an individual order may
    /// be closed straight from a draft, which is promoted to issued first) plus the payment
    /// evidence. Voucher uniqueness and attachment existence stay with the service.
    /// </summary>
    public static CloseStatementCheck ValidateClose(
        PartyBillingStatement statement,
        ClosePartyBillingStatementRequest request)
    {
        static CloseStatementCheck Failed(string error, bool promote = false) =>
            new(error, promote, "", "", Guid.Empty, null);

        var promote = false;
        if (statement.PayeeType == PartyBillingPayeeType.Vendor)
        {
            if (statement.Status != PartyBillingStatementStatus.InvoiceReceived)
                return Failed("لا يُصرف للمورّد إلا بعد ورود الفاتورة ومطابقتها.");
            if (statement.VendorInvoiceMatchedAtUtc is null)
                return Failed("أقر مطابقة الفاتورة قبل توثيق الصرف.");
        }
        else
        {
            if (statement.Status != PartyBillingStatementStatus.Issued
                && statement.Status != PartyBillingStatementStatus.Draft)
                return Failed("لا يُصرف للفرد إلا من أمر صرف صادر أو مُعد.");
            // Individual: promote draft to issued implicitly so the path stays issued → paid.
            promote = statement.Status == PartyBillingStatementStatus.Draft;
        }

        var voucher = (request.DisbursementVoucher ?? request.ExternalInvoiceNumber ?? "").Trim();
        if (voucher.Length == 0)
            return Failed("رقم سند الصرف مطلوب.", promote);

        var transferRef = (request.TransferReference ?? "").Trim();
        if (transferRef.Length == 0)
            return Failed("مرجع التحويل مطلوب.", promote);

        if (!Guid.TryParse(request.TransferReceiptAttachmentId, out var receiptId))
            return Failed("إيصال التحويل (مرفق) مطلوب.", promote);

        return new CloseStatementCheck(
            null,
            promote,
            voucher,
            transferRef,
            receiptId,
            string.IsNullOrWhiteSpace(request.TransferReceiptRef)
                ? null
                : request.TransferReceiptRef.Trim());
    }

    /// <summary>The external invoice number recorded on close differs by payee type.</summary>
    public static string ExternalInvoiceOnClose(PartyBillingStatement statement, string voucher) =>
        statement.PayeeType == PartyBillingPayeeType.Vendor
            ? (statement.VendorInvoiceNumber ?? voucher)
            : voucher;

    /// <summary>A statement is cancellable until it is closed, cancelled, or invoice-matched.</summary>
    public static (string? Error, string Reason) ValidateCancel(
        string status,
        DateTime? vendorInvoiceMatchedAtUtc,
        string? rawReason)
    {
        if (status is PartyBillingStatementStatus.Closed or PartyBillingStatementStatus.Cancelled)
            return ("لا يمكن إلغاء مستند مغلق أو ملغى.", "");
        if (status == PartyBillingStatementStatus.InvoiceReceived
            && vendorInvoiceMatchedAtUtc is not null)
            return ("لا يُلغى مسير بعد مطابقة فاتورة — استخدم الإعادة أو أكمل الصرف.", "");

        var reason = (rawReason ?? "").Trim();
        return reason.Length < 3 ? ("سبب الإلغاء إلزامي.", "") : (null, reason);
    }

    /// <summary>Why a selected due cannot be deferred; null when it can.</summary>
    public static string? DeferLineError(InspectorFeeLedger? ledger, bool isStatementKind)
    {
        if (ledger is null) return "البند غير موجود.";
        if (!isStatementKind) return "الترحيل لمسار صرف المستحقين فقط.";
        return ledger.BillingStatus != InspectorFeeBillingStatus.AtFinance
            ? "لا يمكن ترحيل إلا البنود الجاهزة للصرف."
            : null;
    }

    /// <summary>Human label for a property line: request/deed slot, then district.</summary>
    public static Dictionary<Guid, string> PropertyLabels(
        IEnumerable<CaseStudyPropertySnapshotDto> properties)
    {
        var result = new Dictionary<Guid, string>();
        foreach (var property in properties)
        {
            var slot = string.IsNullOrWhiteSpace(property.RequestNumber)
                ? (string.IsNullOrWhiteSpace(property.DeedNumber)
                    ? property.Id.ToString()[..8]
                    : property.DeedNumber.Trim())
                : property.RequestNumber.Trim();
            var district = property.District?.Trim() ?? "";
            result[property.Id] = string.IsNullOrEmpty(district) ? slot : $"{slot} — {district}";
        }

        return result;
    }

    /// <summary>A court-visit line follows its charge, then the statement it sits on.</summary>
    public static string CourtVisitLineStatus(string chargeStatus, string statementStatus)
    {
        if (chargeStatus == CourtVisitFeeStatuses.Settled
            || statementStatus == PartyBillingStatementStatus.Closed)
            return InspectorFeeBillingStatus.Disbursed;
        return statementStatus == PartyBillingStatementStatus.Cancelled
            ? InspectorFeeBillingStatus.AtFinance
            : InspectorFeeBillingStatus.InStatement;
    }

    /// <summary>Twin ledgers share a workflow task; pick by statement binding when available.</summary>
    public static InspectorFeeLedger? ResolveLedger(
        Guid statementId,
        Guid workflowTaskId,
        IReadOnlyList<InspectorFeeLedger> rows)
    {
        var forTask = rows.Where(l => l.WorkflowTaskId == workflowTaskId).ToList();
        if (forTask.Count == 0) return null;
        var bound = forTask.FirstOrDefault(l => l.PartyBillingStatementId == statementId);
        return bound ?? PartyBillingRowMapper.CollapseReadyLedgers(forTask).FirstOrDefault();
    }

    /// <summary>Projects loaded statements + lines + their fee sources into read DTOs.</summary>
    public static List<PartyBillingStatementDto> MapStatements(
        IReadOnlyList<PartyBillingStatement> statements,
        IReadOnlyList<PartyBillingStatementLine> lines,
        IReadOnlyList<InspectorFeeLedger> ledgerRows,
        IReadOnlyList<CourtVisitFeeCharge> chargeRows,
        IReadOnlyDictionary<Guid, string> labels)
    {
        var chargeById = chargeRows.ToDictionary(c => c.Id);
        var linesByStatement = lines.GroupBy(l => l.StatementId)
            .ToDictionary(g => g.Key, g => g.ToList());

        return statements.Select(s => new PartyBillingStatementDto
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
            RejectedInvoices = PartyBillingRowMapper.ParseRejected(s.RejectedInvoicesJson),
            CancelledAtUtc = s.CancelledAtUtc,
            CancelReason = s.CancelReason,
            Lines = (linesByStatement.GetValueOrDefault(s.Id) ?? [])
                .Select(line => MapLine(s, line, chargeById, ledgerRows, labels))
                .ToList(),
        }).ToList();
    }

    private static PartyBillingStatementLineDto MapLine(
        PartyBillingStatement statement,
        PartyBillingStatementLine line,
        IReadOnlyDictionary<Guid, CourtVisitFeeCharge> chargeById,
        IReadOnlyList<InspectorFeeLedger> ledgerRows,
        IReadOnlyDictionary<Guid, string> labels)
    {
        if (chargeById.TryGetValue(line.WorkflowTaskId, out var charge))
        {
            var chargeStatus = CourtVisitLineStatus(charge.Status, statement.Status);
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

        var ledger = ResolveLedger(statement.Id, line.WorkflowTaskId, ledgerRows);
        var status = ledger?.BillingStatus ?? InspectorFeeBillingStatus.InStatement;
        return new PartyBillingStatementLineDto
        {
            Id = line.Id.ToString(),
            WorkflowTaskId = line.WorkflowTaskId.ToString(),
            PropertyId = ledger?.PropertyId?.ToString(),
            PropertyLabel = ledger?.PropertyId is { } pid && labels.TryGetValue(pid, out var label)
                ? label
                : ledger?.PropertyOrdinal.ToString() ?? "—",
            PoNumber = ledger?.PoNumber ?? "",
            NetFeeSar = line.NetFeeSar,
            BillingStatus = status,
            BillingStatusLabel = InspectorFeeBillingRules.StatusLabel(status),
        };
    }
}
