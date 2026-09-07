using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Financial.Domain;

namespace RealEstateEval.Financial.Application.Rules;

/// <summary>
/// How a draft statement is assembled once the selection has been validated: the lines and
/// ledger moves of a ledger-backed statement, the lines of a court-visit payment order, the
/// header row itself, the same-kind leftovers a create may defer, and the grouping of the
/// monthly vendor run. Pure — the service allocates the reference, saves and notifies.
/// </summary>
public static class PartyBillingDraftRules
{
    /// <summary>The ledger side of a draft: one line per task, the ledger moves, and the total.</summary>
    public sealed record LedgerDraft(
        List<PartyBillingStatementLine> Lines,
        IReadOnlyList<InspectorFeeTransition> Transitions,
        decimal TotalNetSar);

    /// <summary>
    /// Binds every chosen ledger to the statement (in-statement) and sums each task's collapsed
    /// ledgers into one line. Reassignment twins and multi-deed rows share a task, hence a line.
    /// </summary>
    public static LedgerDraft BuildLedgerDraft(
        Guid statementId,
        IReadOnlyList<KeyValuePair<Guid, List<InspectorFeeLedger>>> groups,
        string reference,
        string actorUserId,
        DateTime nowUtc)
    {
        var total = 0m;
        var lines = new List<PartyBillingStatementLine>();
        var transitions = new List<InspectorFeeTransition>();

        foreach (var group in groups)
        {
            var groupLedgers = group.Value;
            var net = PartyBillingStatementRules.NetForGroup(groupLedgers);
            total += net;

            foreach (var ledger in groupLedgers)
            {
                var fromStatus = ledger.BillingStatus;
                ledger.BillingStatus = InspectorFeeBillingStatus.InStatement;
                ledger.PartyBillingStatementId = statementId;
                ledger.UpdatedAtUtc = nowUtc;
                transitions.Add(PartyBillingStatementRules.Transition(
                    ledger,
                    fromStatus,
                    InspectorFeeBillingStatus.InStatement,
                    PartyBillingStatementRules.InsertedInStatementReason(reference),
                    actorUserId,
                    nowUtc));
            }

            lines.Add(new PartyBillingStatementLine
            {
                Id = Guid.NewGuid(),
                StatementId = statementId,
                WorkflowTaskId = group.Key,
                NetFeeSar = net,
            });
        }

        return new LedgerDraft(lines, transitions, total);
    }

    /// <summary>Court-visit lines are keyed by the charge id (same column as the workflow task id).</summary>
    public static List<PartyBillingStatementLine> CourtVisitLines(
        Guid statementId,
        IReadOnlyList<CourtVisitFeeCharge> charges) =>
        charges.Select(c => new PartyBillingStatementLine
        {
            Id = Guid.NewGuid(),
            StatementId = statementId,
            WorkflowTaskId = c.Id,
            NetFeeSar = c.AmountSar,
        }).ToList();

    /// <summary>The draft header row; notes are stored trimmed or null.</summary>
    public static PartyBillingStatement NewDraft(
        Guid statementId,
        string reference,
        string assigneeId,
        string payeeType,
        string? taskKind,
        decimal totalNetSar,
        string? notes,
        string actorUserId,
        DateTime nowUtc,
        List<PartyBillingStatementLine> lines) => new()
        {
            Id = statementId,
            ReferenceNumber = reference,
            AssigneeId = assigneeId,
            PayeeType = payeeType,
            TaskKind = taskKind,
            Status = PartyBillingStatementStatus.Draft,
            TotalNetSar = totalNetSar,
            CreatedByUserId = actorUserId,
            CreatedAtUtc = nowUtc,
            Notes = PartyBillingStatementRules.NormalizeNotes(notes),
            Lines = lines,
        };

    /// <summary>
    /// Of the party's unselected at-finance ledgers, only those whose task is the statement's
    /// own kind are deferred by the create; other kinds stay ready.
    /// </summary>
    public static List<InspectorFeeLedger> SameKindLeftovers(
        IReadOnlyList<InspectorFeeLedger> unselected,
        IReadOnlyDictionary<Guid, WorkflowTaskKind> taskKinds,
        WorkflowTaskKind statementKind) =>
        unselected
            .Where(l => taskKinds.TryGetValue(l.WorkflowTaskId, out var kind) && kind == statementKind)
            .ToList();

    /// <summary>The monthly run bills vendors only, one statement per vendor.</summary>
    public static List<IGrouping<string, PartyBillingReadyLineDto>> VendorReadyByAssignee(
        IEnumerable<PartyBillingReadyLineDto> ready) =>
        ready
            .Where(l => l.PayeeType == PartyBillingPayeeType.Vendor && l.AssigneeId is not null)
            .GroupBy(l => l.AssigneeId!, StringComparer.Ordinal)
            .ToList();

    public static string MonthRunNotes(DateTime monthStart) => $"مسير آلي — {monthStart:yyyy-MM}";

    /// <summary>The run's outcome; nothing created is reported as an error, not an empty success.</summary>
    public static CreateMonthPartyBillingStatementsResponseDto MonthRunResponse(
        IReadOnlyList<PartyBillingStatementDto> created,
        int linesIncluded) => new()
        {
            Created = created,
            AssigneesCovered = created.Count,
            LinesIncluded = linesIncluded,
            Error = created.Count == 0
                ? "لم يُنشأ أي مسير — قد تكون المسيرات مفتوحة مسبقاً لنفس الشهر."
                : null,
        };
}
