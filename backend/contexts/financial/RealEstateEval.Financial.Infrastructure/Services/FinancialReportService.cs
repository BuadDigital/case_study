using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Caching;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Financial.Application.Abstractions;
using RealEstateEval.Financial.Infrastructure.Data.Contexts;
using RealEstateEval.Financial.Application.Contracts;
using RealEstateEval.Financial.Domain;

namespace RealEstateEval.Financial.Infrastructure.Services;

/// <summary>
/// Financial summary. Owned fee/config tables live on <see cref="FinancialDbContext"/>;
/// completed case-study property filters use <see cref="ICaseStudyLookup"/>;
/// assignee display names use <see cref="IIdentityDirectory"/>.
/// </summary>
public sealed class FinancialReportService : IFinancialReportService
{
    private static readonly Guid SingletonId = Guid.Parse("f1a2b3c4-d5e6-7890-abcd-ef1234567890");
    private static readonly CultureInfo ArCulture = CultureInfo.GetCultureInfo("ar-SA");

    private readonly FinancialDbContext _fin;
    private readonly ICaseStudyLookup _caseStudy;
    private readonly IIdentityDirectory _identity;
    private readonly ApiResponseCache _cache;
    private readonly TimeProvider _time;

    public FinancialReportService(
        FinancialDbContext fin,
        ICaseStudyLookup caseStudy,
        IIdentityDirectory identity,
        ApiResponseCache cache)
        : this(fin, caseStudy, identity, cache, null)
    {
    }

    [ActivatorUtilitiesConstructor]
    public FinancialReportService(
        FinancialDbContext fin,
        ICaseStudyLookup caseStudy,
        IIdentityDirectory identity,
        ApiResponseCache cache,
        TimeProvider? time = null)
    {
        _time = time ?? TimeProvider.System;

        _fin = fin;
        _caseStudy = caseStudy;
        _identity = identity;
        _cache = cache;
    }

    public async Task<FinancialSummaryDto> GetSummaryAsync(CancellationToken cancellationToken = default)
    {
        return await _cache.GetOrCreateAsync(
            CacheKeys.FinancialSummary,
            CacheDurations.Financial,
            BuildFromDatabaseAsync,
            cancellationToken);
    }

    public async Task<FinancialSummaryDto> SaveSummaryAsync(
        FinancialSummaryDto request,
        CancellationToken cancellationToken = default)
    {
        var payload = System.Text.Json.JsonSerializer.Serialize(request);
        var row = await _fin.FinancialReportConfigs
            .FirstOrDefaultAsync(x => x.Id == SingletonId, cancellationToken);
        var now = _time.UtcNow();

        if (row is null)
        {
            row = new FinancialReportConfig
            {
                Id = SingletonId,
                ReportJson = payload,
                UpdatedAtUtc = now,
            };
            _fin.FinancialReportConfigs.Add(row);
        }
        else
        {
            row.ReportJson = payload;
            row.UpdatedAtUtc = now;
        }

        await _fin.SaveChangesAsync(cancellationToken);
        await _cache.RemoveAsync(CacheKeys.FinancialSummary, cancellationToken);
        return request;
    }

    private async Task<FinancialSummaryDto> BuildFromDatabaseAsync(CancellationToken cancellationToken)
    {
        var completedLedgers = await CompletedCaseStudyLedgersAsync(cancellationToken);
        var costRows = await BuildCostRowsAsync(completedLedgers, cancellationToken);
        var revenueRows = await BuildRevenueRowsAsync(completedLedgers, cancellationToken);

        var externalCosts = await completedLedgers
            .Where(l => l.InspectorType != InspectorFeeRules.TypeEmployee)
            .SumAsync(
                l => (decimal?)(l.AgreedFeeSar - l.SupervisorDiscountSar),
                cancellationToken) ?? 0m;
        var pendingPayables = await completedLedgers
            .Where(l => l.BillingStatus == InspectorFeeBillingStatus.AtFinance
                || l.BillingStatus == InspectorFeeBillingStatus.Deferred
                || l.BillingStatus == InspectorFeeBillingStatus.InStatement
                || l.BillingStatus == InspectorFeeBillingStatus.DisbReq)
            .SumAsync(
                l => (decimal?)(l.AgreedFeeSar - l.SupervisorDiscountSar),
                cancellationToken) ?? 0m;

 // Collected Enfaz invoices only — entitlements / unissued lines do not count as revenue.
        var invoices = await _fin.PoEnfazInvoices.AsNoTracking()
            .Where(i => i.CollectedAmountSar > 0)
            .ToListAsync(cancellationToken);
        var collectedPoNumbers = invoices.Select(i => i.PoNumber).ToHashSet(StringComparer.Ordinal);
        var collectedLines = collectedPoNumbers.Count == 0
            ? []
            : await _fin.PoEnfazRevenueLines.AsNoTracking()
                .Where(l => collectedPoNumbers.Contains(l.PoNumber) && l.IncludedInBilling)
                .ToListAsync(cancellationToken);

        decimal enfazCoreCollected = 0m;
        decimal keyViaEnfazCollected = 0m;
        foreach (var invoice in invoices)
        {
            var ratio = invoice.TotalSar > 0
                ? Math.Min(1m, invoice.CollectedAmountSar / invoice.TotalSar)
                : 0m;
            var lines = collectedLines.Where(l => l.PoNumber == invoice.PoNumber).ToList();
            var core = lines.Sum(l => l.CaseStudyFeeSar + l.SurveyFeeSar);
            var keys = lines.Sum(l => l.KeyFeeSar);
            if (core + keys <= 0 && invoice.SubtotalSar > 0)
            {
 // Fallback when lines were wiped after issue: use stamped invoice subtotal.
                enfazCoreCollected += Math.Round(invoice.SubtotalSar * ratio, 2, MidpointRounding.AwayFromZero);
                continue;
            }

            enfazCoreCollected += Math.Round(core * ratio, 2, MidpointRounding.AwayFromZero);
            keyViaEnfazCollected += Math.Round(keys * ratio, 2, MidpointRounding.AwayFromZero);
        }

 // Historical only. Nothing stamps key-receipt amounts any more — registering the envelope
 // marks the entitlement and finance bills إنفاذ by hand — so this line covers the charges
 // written before that change and empties out on its own.
        var keyReceiptSummary = await _fin.KeyReceiptFeeCharges.AsNoTracking()
            .GroupBy(_ => 1)
            .Select(group => new
            {
                Total = group.Sum(c => c.AmountSar),
                Collected = group.Count(c =>
                    c.CollectionStatus == KeyReceiptFeeStatuses.Collected),
                Count = group.Count(),
            })
            .SingleOrDefaultAsync(cancellationToken);
        var visitFeeSummary = await _fin.CourtVisitFeeCharges.AsNoTracking()
            .GroupBy(_ => 1)
            .Select(group => new
            {
                Total = group.Sum(c => c.AmountSar),
                Open = group
                    .Where(c => c.Status == CourtVisitFeeStatuses.Open)
                    .Sum(c => (decimal?)c.AmountSar) ?? 0m,
            })
            .SingleOrDefaultAsync(cancellationToken);

        var keyReceiptTotal = keyReceiptSummary?.Total ?? 0m;
        var visitFeeTotal = visitFeeSummary?.Total ?? 0m;
        var revenueTotal = enfazCoreCollected + keyViaEnfazCollected + keyReceiptTotal;
        var profitMargin = revenueTotal - (externalCosts + visitFeeTotal);

        if (visitFeeTotal > 0)
        {
            costRows.Add(new FinancialCostRowDto
            {
                Name = "أتعاب الزيارة",
                Type = "free",
                Cost = FormatSar(visitFeeTotal),
                Category = "زيارة محكمة",
            });
        }

        if (enfazCoreCollected > 0)
        {
            revenueRows.Insert(0, new FinancialRevenueRowDto
            {
                Po = "إيراد إنفاذ (محصّل)",
                Billed = invoices.Count(i => i.Status == PoEnfazInvoiceStatus.Collected),
                Excluded = invoices.Count(i => i.Status != PoEnfazInvoiceStatus.Collected),
                Value = FormatSar(enfazCoreCollected),
                Status = invoices.All(i => i.Status == PoEnfazInvoiceStatus.Collected)
                    ? FinancialRevenueRowStatuses.Done
                    : FinancialRevenueRowStatuses.Progress,
                InvoiceNumber = null,
            });
        }

        if (keyViaEnfazCollected > 0)
        {
            revenueRows.Add(new FinancialRevenueRowDto
            {
                Po = "مفاتيح (فوترة إنفاذ)",
                Billed = collectedLines.Count(l => l.KeyFeeSar > 0),
                Excluded = 0,
                Value = FormatSar(keyViaEnfazCollected),
                Status = FinancialRevenueRowStatuses.Done,
                InvoiceNumber = null,
            });
        }

        if (keyReceiptTotal > 0)
        {
            revenueRows.Add(new FinancialRevenueRowDto
            {
                Po = "أتعاب استلام مفاتيح",
                Billed = keyReceiptSummary!.Collected,
                Excluded = keyReceiptSummary.Count - keyReceiptSummary.Collected,
                Value = FormatSar(keyReceiptTotal),
                Status = keyReceiptSummary.Collected == keyReceiptSummary.Count
                    ? FinancialRevenueRowStatuses.Done
                    : FinancialRevenueRowStatuses.Progress,
                InvoiceNumber = null,
            });
        }

        return new FinancialSummaryDto
        {
            PeriodLabel = CurrentPeriodLabel(),
            RevenueTotal = FormatSar(revenueTotal),
            ExternalCostsTotal = FormatSar(externalCosts + visitFeeTotal),
            ProfitMarginTotal = FormatSar(profitMargin),
            ProfitMarginPercentLabel = MarginPercentLabel(revenueTotal, profitMargin),
            PendingPayablesTotal = FormatSar(pendingPayables + (visitFeeSummary?.Open ?? 0m)),
            RevenueGrandTotal = FormatSar(revenueTotal),
            RevenueRows = revenueRows,
            CostRows = costRows,
        };
    }

    private async Task<IQueryable<InspectorFeeLedger>> CompletedCaseStudyLedgersAsync(
        CancellationToken cancellationToken)
    {
 // Cross-context filter: property ids must be materialized from Case Study before filtering Financial.
        var completedPropertyIds = await _caseStudy.ListCompletedCaseStudyPropertyIdsAsync(cancellationToken);

        return _fin.InspectorFeeLedgers.AsNoTracking()
 // Disputed lines have no agreed amount yet and suspended ones are withheld, so neither is
 // a committed cost. Excluding them here keeps them out of every aggregate: costs, margin,
 // payables, and the per-PO tracked/disbursed counts.
            .Where(ledger =>
                ledger.BillingStatus != InspectorFeeBillingStatus.Disputed
                && ledger.BillingStatus != InspectorFeeBillingStatus.Suspended)
            .Where(ledger =>
                ledger.PropertyId != null
                && completedPropertyIds.Contains(ledger.PropertyId.Value));
    }

    private async Task<Dictionary<string, string>> LoadAssigneeNamesAsync(
        IReadOnlyList<string> assigneeIds,
        CancellationToken cancellationToken)
    {
        if (assigneeIds.Count == 0)
            return new Dictionary<string, string>(StringComparer.Ordinal);

        var loaded = await _identity.ResolveDisplayNamesByAssigneeIdsAsync(assigneeIds, cancellationToken);
        var map = loaded.ToDictionary(kv => kv.Key, kv => kv.Value, StringComparer.Ordinal);

        foreach (var id in assigneeIds)
        {
            if (map.ContainsKey(id)) continue;
            map[id] = id;
        }

        return map;
    }

    private async Task<List<FinancialCostRowDto>> BuildCostRowsAsync(
        IQueryable<InspectorFeeLedger> completedLedgers,
        CancellationToken cancellationToken)
    {
 // Project scalars only so InspectorFeeLedger entities are not materialized (F/D10 report tests).
        var ledgerSlices = await completedLedgers
            .Select(ledger => new
            {
                AssigneeId = ledger.AssigneeId == null || ledger.AssigneeId.Trim() == ""
                    ? "—"
                    : ledger.AssigneeId.Trim(),
                ledger.InspectorType,
                ledger.WorkflowTaskId,
                Net = ledger.AgreedFeeSar - ledger.SupervisorDiscountSar,
            })
            .ToListAsync(cancellationToken);

        var taskIds = ledgerSlices.Select(row => row.WorkflowTaskId).Distinct().ToList();
        var kindByTask = taskIds.Count == 0
            ? new Dictionary<Guid, WorkflowTaskKind>()
            : (await _caseStudy.GetWorkflowTaskKindsAsync(taskIds, cancellationToken))
                .ToDictionary(kv => kv.Key, kv => kv.Value);

        var aggregates = ledgerSlices
            .GroupBy(row => new
            {
                row.AssigneeId,
                row.InspectorType,
                Kind = kindByTask.TryGetValue(row.WorkflowTaskId, out var kind)
                    ? (WorkflowTaskKind?)kind
                    : null,
            })
            .Select(grouped => new
            {
                grouped.Key.AssigneeId,
                grouped.Key.InspectorType,
                grouped.Key.Kind,
                Total = grouped.Sum(row => row.Net),
                Count = grouped.Count(),
            })
            .ToList();

        var assigneeIds = aggregates
            .Select(row => row.AssigneeId)
            .Where(id => id != "—")
            .Distinct(StringComparer.Ordinal)
            .ToList();
        var nameByAssigneeId = await LoadAssigneeNamesAsync(assigneeIds, cancellationToken);

        return aggregates
            .GroupBy(row => row.AssigneeId, StringComparer.Ordinal)
            .Select(group =>
            {
                var dominantType = group
                    .GroupBy(row => row.InspectorType)
                    .OrderByDescending(typeGroup => typeGroup.Sum(row => row.Count))
                    .Select(typeGroup => typeGroup.Key)
                    .FirstOrDefault() ?? InspectorFeeRules.TypeEmployee;
                var dominantKind = group
                    .Where(row => row.Kind.HasValue)
                    .GroupBy(row => row.Kind!.Value)
                    .OrderByDescending(kindGroup => kindGroup.Sum(row => row.Count))
                    .Select(kindGroup => kindGroup.Key)
                    .FirstOrDefault();

                return new FinancialCostRowDto
                {
                    Name = group.Key == "—"
                        ? "غير مسند"
                        : nameByAssigneeId.GetValueOrDefault(group.Key, group.Key),
                    Type = CostTypeCode(dominantType),
                    Cost = FormatSar(group.Sum(row => row.Total)),
                    Category = WorkflowTaskKindLabels.CategoryLabelAr(dominantKind),
                };
            })
            .OrderBy(r => r.Name, StringComparer.Ordinal)
            .ToList();
    }

    private async Task<List<FinancialRevenueRowDto>> BuildRevenueRowsAsync(
        IQueryable<InspectorFeeLedger> completedLedgers,
        CancellationToken cancellationToken)
    {
        var orders = await _caseStudy.ListWorkOrderSummariesAsync(cancellationToken);

        if (orders.Count == 0)
            return [];

        var enfazByPo = await _fin.PoEnfazRevenueLines.AsNoTracking()
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
            .ToDictionaryAsync(x => x.PoNumber.Trim(), x => x, StringComparer.Ordinal, cancellationToken);

        var invoicesByPo = await _fin.PoEnfazInvoices.AsNoTracking()
            .ToDictionaryAsync(
                x => x.PoNumber.Trim(),
                x => x,
                StringComparer.Ordinal,
                cancellationToken);
        var ledgersByPo = await completedLedgers
            .GroupBy(ledger => ledger.PoNumber.Trim())
            .Select(group => new
            {
                PoNumber = group.Key,
                Tracked = group.Count(),
                Disbursed = group.Count(ledger =>
                    ledger.BillingStatus == InspectorFeeBillingStatus.Disbursed),
            })
            .ToDictionaryAsync(row => row.PoNumber, StringComparer.Ordinal, cancellationToken);

        var rows = new List<FinancialRevenueRowDto>();
        foreach (var order in orders)
        {
            var po = order.PoNumber;
            var propertyCount = order.PropertyCount;
            ledgersByPo.TryGetValue(po, out var ledger);
            var disbursed = ledger?.Disbursed ?? 0;
            var tracked = ledger?.Tracked ?? 0;
            var excluded = Math.Max(0, propertyCount - tracked);
            enfazByPo.TryGetValue(po, out var enfaz);
            invoicesByPo.TryGetValue(po, out var invoice);
            var ratio = invoice is not null && invoice.TotalSar > 0
                ? Math.Min(1m, invoice.CollectedAmountSar / invoice.TotalSar)
                : 0m;
            var enfazTotal = Math.Round((enfaz?.Total ?? 0m) * ratio, 2, MidpointRounding.AwayFromZero);
            var enfazFilled = enfaz?.Filled ?? 0;
            var status = invoice?.Status == PoEnfazInvoiceStatus.Collected
                ? FinancialRevenueRowStatuses.Done
                : FinancialRevenueRowStatuses.Progress;

            rows.Add(new FinancialRevenueRowDto
            {
                Po = po,
                Billed = enfazFilled > 0 ? enfazFilled : disbursed,
                Excluded = excluded,
                Value = enfazTotal > 0 ? FormatSar(enfazTotal) : "—",
                Status = status,
                InvoiceNumber = invoice?.InvoiceNumber,
            });
        }

        return rows;
    }

    private static string CostTypeCode(string inspectorType) =>
        inspectorType switch
        {
            InspectorFeeRules.TypeEmployee => "int",
            InspectorFeeRules.TypeCooperatorIndividual
                or InspectorFeeRules.TypeCooperatorOrganization
                or InspectorFeeRules.TypeCooperatorLegacy
                => "free",
            _ => "ext",
        };

    private static string FormatSar(decimal amount) =>
        $"{amount.ToString("N0", ArCulture)} ر.س";

    private static string MarginPercentLabel(decimal revenue, decimal margin)
    {
        if (revenue <= 0) return "—";
        var pct = (int)Math.Round(margin / revenue * 100m, MidpointRounding.AwayFromZero);
        return $"{pct}% من الإيرادات";
    }

    private string CurrentPeriodLabel()
    {
        var now = _time.UtcNow();
        return now.ToString("MMMM yyyy", ArCulture);
    }
}
