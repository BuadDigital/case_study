using RealEstateEval.Application;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Financial.Application.Rules;

namespace RealEstateEval.Financial.Application.Services;

/// <summary>
/// The receivables view of the Enfaz billing use case: the tracking scan every list is cut
/// from, and the aging report over the open invoices.
/// </summary>
public sealed partial class PoEnfazBillingService
{
    public async Task<IReadOnlyList<EnfazTrackingRowDto>> ListTrackingAsync(
        CancellationToken cancellationToken = default)
    {
        var rows = await ScanTrackingRowsAsync(cancellationToken);
        return rows.Take(MaxTrackingRows).ToList();
    }

    /// <summary>
    /// Every tracking row the scan yields, uncapped — the list the contract's search, sort and
    /// page window are applied to (pagination-contract §10.2).
    /// </summary>
    private async Task<List<EnfazTrackingRowDto>> ScanTrackingRowsAsync(
        CancellationToken cancellationToken)
    {
        var orders = await _lookup.ListWorkOrdersForBillingAsync(MaxOrderRows, cancellationToken);

        if (orders.Count == 0) return [];

        var poNumbers = orders.Select(o => o.PoNumber.Trim()).ToList();
        var enfazLines = await _db.ListRevenueLinesForPosAsync(poNumbers, cancellationToken);
        var enfazByKey = enfazLines.ToDictionary(
            x => (x.PoNumber.Trim(), x.PropertyId),
            x => x);

        var invoicesByPo = await _db.ListInvoicesByPoAsync(poNumbers, cancellationToken);

        var flags = await _db.ListFinanceFlagsAsync(poNumbers, cancellationToken);
        var followupCountByPo = await _db.CountFollowupsByPoAsync(poNumbers, cancellationToken);

        var allPropertyIds = orders.SelectMany(o => o.Properties.Select(p => p.Id)).ToList();
        var allTasks = (await _lookup.ListWorkflowTasksByPoNumbersAsync(poNumbers, cancellationToken))
            .Select(s => s.ToWorkflowTask())
            .Where(t => t.PropertyId != null && allPropertyIds.Contains(t.PropertyId.Value))
            .ToList();
        var taskStatusesByPo = PoEnfazWorkStatusRules.BuildPropertyWorkStatusesByPo(allTasks);
        var completedAtByProperty = PoEnfazWorkStatusRules.BuildPropertyCompletedAtById(allTasks);

        var now = _time.UtcNow();
        var rows = new List<EnfazTrackingRowDto>();
        foreach (var order in orders)
        {
            var po = order.PoNumber.Trim();
            var taskStatuses = taskStatusesByPo.GetValueOrDefault(po, []);
            invoicesByPo.TryGetValue(po, out var invoice);
            var overdue = PoEnfazInvoiceRules.IsOverdue(invoice, now);
            var followupCount = followupCountByPo.GetValueOrDefault(po, 0);
            var poFlags = flags.Where(f =>
                string.Equals(f.PoNumber.Trim(), po, StringComparison.Ordinal)).ToList();

            foreach (var property in order.Properties.OrderBy(
                p => PoEnfazRevenueRules.PropertyOrderKey(p),
                StringComparer.Ordinal))
            {
                enfazByKey.TryGetValue((po, property.Id), out var enfaz);
                completedAtByProperty.TryGetValue(property.Id, out var taskCompletedAt);

                rows.Add(PoEnfazRevenueRules.ToTrackingRow(
                    po,
                    property,
                    PoEnfazRevenueRules.WorkOrInProgress(taskStatuses, property.Id),
                    enfaz,
                    taskCompletedAt,
                    invoice,
                    overdue,
                    PoEnfazWorkStatusRules.ResolveFinanceFlag(poFlags, property.Id),
                    followupCount));
            }
        }

        return rows;
    }

    public async Task<EnfazAgingReportDto> GetAgingReportAsync(
        CancellationToken cancellationToken = default)
    {
        var asOf = _time.UtcNow();
        var invoices = await _db.ListOutstandingInvoicesAsync(cancellationToken);

        return PoEnfazInvoiceRules.BuildAgingReport(invoices, asOf);
    }
}
