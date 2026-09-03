using RealEstateEval.Financial.Domain;

namespace RealEstateEval.Financial.Application.Abstractions;

/// <summary>One inspector-fee ledger row reduced to the fields the cost table groups on.</summary>
public sealed record LedgerCostSlice(
    string AssigneeId,
    string InspectorType,
    Guid WorkflowTaskId,
    decimal Net);

/// <summary>Per-PO ledger counts behind the revenue table's tracked / disbursed columns.</summary>
public sealed record PoLedgerCounts(int Tracked, int Disbursed);

/// <summary>Per-PO Enfaz revenue-line totals: billed value and how many lines carry an amount.</summary>
public sealed record PoRevenueLineTotals(decimal Total, int Filled);

public sealed record KeyReceiptFeeTotals(decimal Total, int Collected, int Count);

public sealed record CourtVisitFeeTotals(decimal Total, decimal Open);

/// <summary>
/// Persistence boundary for the financial summary report. Every aggregate is computed in the
/// database and handed back materialised, so the use case in <c>Financial.Application</c> never
/// composes a query — only the Infrastructure adapter opens EF. Reads are untracked.
/// </summary>
/// <remarks>
/// The ledger reads take the completed case-study property ids because that filter crosses
/// contexts: the ids are materialised from Case Study before the Financial query can use them.
/// Disputed and suspended ledgers are excluded by every one of them, so they stay out of costs,
/// margin, payables, and the per-PO counts alike.
/// </remarks>
public interface IFinancialReportRepository
{
    /// <summary>Upserts the singleton dashboard payload.</summary>
    Task SaveReportJsonAsync(string payload, DateTime nowUtc, CancellationToken cancellationToken);

    /// <summary>
    /// Net committed cost of the completed ledgers: <c>ExternalCosts</c> covers every
    /// non-employee inspector, <c>PendingPayables</c> the statuses still awaiting disbursement.
    /// </summary>
    Task<(decimal ExternalCosts, decimal PendingPayables)> SumCompletedLedgerCostsAsync(
        IReadOnlyCollection<Guid> completedPropertyIds,
        CancellationToken cancellationToken);

    /// <summary>Scalar projection only; ledger entities are never materialised.</summary>
    Task<IReadOnlyList<LedgerCostSlice>> ListCompletedLedgerCostSlicesAsync(
        IReadOnlyCollection<Guid> completedPropertyIds,
        CancellationToken cancellationToken);

    /// <summary>Keyed by trimmed PO number.</summary>
    Task<IReadOnlyDictionary<string, PoLedgerCounts>> CountCompletedLedgersByPoAsync(
        IReadOnlyCollection<Guid> completedPropertyIds,
        CancellationToken cancellationToken);

    /// <summary>Enfaz invoices with a collected amount — entitlements are not revenue.</summary>
    Task<IReadOnlyList<PoEnfazInvoice>> ListCollectedInvoicesAsync(CancellationToken cancellationToken);

    /// <summary>Billable revenue lines of the given POs.</summary>
    Task<IReadOnlyList<PoEnfazRevenueLine>> ListBilledRevenueLinesAsync(
        IReadOnlyCollection<string> poNumbers,
        CancellationToken cancellationToken);

    /// <summary>Keyed by trimmed PO number.</summary>
    Task<IReadOnlyDictionary<string, PoRevenueLineTotals>> SummariseRevenueLinesByPoAsync(
        CancellationToken cancellationToken);

    /// <summary>Keyed by trimmed PO number.</summary>
    Task<IReadOnlyDictionary<string, PoEnfazInvoice>> ListInvoicesByPoAsync(
        CancellationToken cancellationToken);

    /// <summary>Zeroed totals when no charge rows exist.</summary>
    Task<KeyReceiptFeeTotals> SummariseKeyReceiptChargesAsync(CancellationToken cancellationToken);

    /// <summary>Zeroed totals when no charge rows exist.</summary>
    Task<CourtVisitFeeTotals> SummariseCourtVisitChargesAsync(CancellationToken cancellationToken);
}
