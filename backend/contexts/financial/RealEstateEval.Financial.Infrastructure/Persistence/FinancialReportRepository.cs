using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Financial.Application.Abstractions;
using RealEstateEval.Financial.Domain;
using RealEstateEval.Financial.Infrastructure.Data.Contexts;

namespace RealEstateEval.Financial.Infrastructure.Persistence;

/// <summary>
/// EF adapter for <see cref="IFinancialReportRepository"/>. Owns every query the financial
/// summary needs, including the disputed/suspended exclusion the ledger aggregates share.
/// </summary>
public sealed class FinancialReportRepository : IFinancialReportRepository
{
    private static readonly Guid ReportConfigId = Guid.Parse("f1a2b3c4-d5e6-7890-abcd-ef1234567890");

    private readonly FinancialDbContext _fin;

    public FinancialReportRepository(FinancialDbContext fin) => _fin = fin;

    public async Task SaveReportJsonAsync(
        string payload,
        DateTime nowUtc,
        CancellationToken cancellationToken)
    {
        var row = await _fin.FinancialReportConfigs
            .FirstOrDefaultAsync(x => x.Id == ReportConfigId, cancellationToken);

        if (row is null)
        {
            row = new FinancialReportConfig
            {
                Id = ReportConfigId,
                ReportJson = payload,
                UpdatedAtUtc = nowUtc,
            };
            _fin.FinancialReportConfigs.Add(row);
        }
        else
        {
            row.ReportJson = payload;
            row.UpdatedAtUtc = nowUtc;
        }

        await _fin.SaveChangesAsync(cancellationToken);
    }

    public async Task<(decimal ExternalCosts, decimal PendingPayables)> SumCompletedLedgerCostsAsync(
        IReadOnlyCollection<Guid> completedPropertyIds,
        CancellationToken cancellationToken)
    {
        var ledgers = CompletedLedgers(completedPropertyIds);

        var externalCosts = await ledgers
            .Where(l => l.InspectorType != InspectorFeeRules.TypeEmployee)
            .SumAsync(
                l => (decimal?)(l.AgreedFeeSar - l.SupervisorDiscountSar),
                cancellationToken) ?? 0m;
        var pendingPayables = await ledgers
            .Where(l => l.BillingStatus == InspectorFeeBillingStatus.AtFinance
                || l.BillingStatus == InspectorFeeBillingStatus.Deferred
                || l.BillingStatus == InspectorFeeBillingStatus.InStatement
                || l.BillingStatus == InspectorFeeBillingStatus.DisbReq)
            .SumAsync(
                l => (decimal?)(l.AgreedFeeSar - l.SupervisorDiscountSar),
                cancellationToken) ?? 0m;

        return (externalCosts, pendingPayables);
    }

    public async Task<IReadOnlyList<LedgerCostSlice>> ListCompletedLedgerCostSlicesAsync(
        IReadOnlyCollection<Guid> completedPropertyIds,
        CancellationToken cancellationToken) =>
        // Project scalars only so InspectorFeeLedger entities are not materialized (F/D10 report tests).
        await CompletedLedgers(completedPropertyIds)
            .Select(ledger => new LedgerCostSlice(
                ledger.AssigneeId == null || ledger.AssigneeId.Trim() == ""
                    ? "—"
                    : ledger.AssigneeId.Trim(),
                ledger.InspectorType,
                ledger.WorkflowTaskId,
                ledger.AgreedFeeSar - ledger.SupervisorDiscountSar))
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyDictionary<string, PoLedgerCounts>> CountCompletedLedgersByPoAsync(
        IReadOnlyCollection<Guid> completedPropertyIds,
        CancellationToken cancellationToken)
    {
        var rows = await CompletedLedgers(completedPropertyIds)
            .GroupBy(ledger => ledger.PoNumber.Trim())
            .Select(group => new
            {
                PoNumber = group.Key,
                Tracked = group.Count(),
                Disbursed = group.Count(ledger =>
                    ledger.BillingStatus == InspectorFeeBillingStatus.Disbursed),
            })
            .ToListAsync(cancellationToken);

        return rows.ToDictionary(
            row => row.PoNumber,
            row => new PoLedgerCounts(row.Tracked, row.Disbursed),
            StringComparer.Ordinal);
    }

    public async Task<IReadOnlyList<PoEnfazInvoice>> ListCollectedInvoicesAsync(
        CancellationToken cancellationToken) =>
        await _fin.PoEnfazInvoices.AsNoTracking()
            .Where(i => i.CollectedAmountSar > 0)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<PoEnfazRevenueLine>> ListBilledRevenueLinesAsync(
        IReadOnlyCollection<string> poNumbers,
        CancellationToken cancellationToken)
    {
        if (poNumbers.Count == 0) return [];

        return await _fin.PoEnfazRevenueLines.AsNoTracking()
            .Where(l => poNumbers.Contains(l.PoNumber) && l.IncludedInBilling)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyDictionary<string, PoRevenueLineTotals>> SummariseRevenueLinesByPoAsync(
        CancellationToken cancellationToken)
    {
        var rows = await _fin.PoEnfazRevenueLines.AsNoTracking()
            .GroupBy(x => x.PoNumber)
            .Select(g => new
            {
                PoNumber = g.Key,
                Total = g.Where(x => x.IncludedInBilling)
                    .Sum(x => x.CaseStudyFeeSar + x.SurveyFeeSar + x.KeyFeeSar),
                Filled = g.Count(x =>
                    x.IncludedInBilling
                    && (x.CaseStudyFeeSar + x.SurveyFeeSar + x.KeyFeeSar) > 0),
            })
            .ToListAsync(cancellationToken);

        return rows.ToDictionary(
            row => row.PoNumber.Trim(),
            row => new PoRevenueLineTotals(row.Total, row.Filled),
            StringComparer.Ordinal);
    }

    public async Task<IReadOnlyDictionary<string, PoEnfazInvoice>> ListInvoicesByPoAsync(
        CancellationToken cancellationToken) =>
        await _fin.PoEnfazInvoices.AsNoTracking()
            .ToDictionaryAsync(
                x => x.PoNumber.Trim(),
                x => x,
                StringComparer.Ordinal,
                cancellationToken);

    public async Task<KeyReceiptFeeTotals> SummariseKeyReceiptChargesAsync(
        CancellationToken cancellationToken)
    {
        var summary = await _fin.KeyReceiptFeeCharges.AsNoTracking()
            .GroupBy(_ => 1)
            .Select(group => new
            {
                Total = group.Sum(c => c.AmountSar),
                Collected = group.Count(c =>
                    c.CollectionStatus == KeyReceiptFeeStatuses.Collected),
                Count = group.Count(),
            })
            .SingleOrDefaultAsync(cancellationToken);

        return summary is null
            ? new KeyReceiptFeeTotals(0m, 0, 0)
            : new KeyReceiptFeeTotals(summary.Total, summary.Collected, summary.Count);
    }

    public async Task<CourtVisitFeeTotals> SummariseCourtVisitChargesAsync(
        CancellationToken cancellationToken)
    {
        var summary = await _fin.CourtVisitFeeCharges.AsNoTracking()
            .GroupBy(_ => 1)
            .Select(group => new
            {
                Total = group.Sum(c => c.AmountSar),
                Open = group
                    .Where(c => c.Status == CourtVisitFeeStatuses.Open)
                    .Sum(c => (decimal?)c.AmountSar) ?? 0m,
            })
            .SingleOrDefaultAsync(cancellationToken);

        return summary is null
            ? new CourtVisitFeeTotals(0m, 0m)
            : new CourtVisitFeeTotals(summary.Total, summary.Open);
    }

    /// <summary>
    /// Disputed lines have no agreed amount yet and suspended ones are withheld, so neither is
    /// a committed cost. Excluding them here keeps them out of every aggregate: costs, margin,
    /// payables, and the per-PO tracked/disbursed counts.
    /// </summary>
    private IQueryable<InspectorFeeLedger> CompletedLedgers(
        IReadOnlyCollection<Guid> completedPropertyIds) =>
        _fin.InspectorFeeLedgers.AsNoTracking()
            .Where(ledger =>
                ledger.BillingStatus != InspectorFeeBillingStatus.Disputed
                && ledger.BillingStatus != InspectorFeeBillingStatus.Suspended)
            .Where(ledger =>
                ledger.PropertyId != null
                && completedPropertyIds.Contains(ledger.PropertyId.Value));
}
