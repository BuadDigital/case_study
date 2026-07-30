using System.Globalization;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Caching;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Infrastructure.Services;

public sealed class FinancialReportService : IFinancialReportService
{
    private static readonly Guid SingletonId = Guid.Parse("f1a2b3c4-d5e6-7890-abcd-ef1234567890");
    private static readonly CultureInfo ArCulture = CultureInfo.GetCultureInfo("ar-SA");

    private readonly ApplicationDbContext _db;
    private readonly ApiResponseCache _cache;

    public FinancialReportService(ApplicationDbContext db, ApiResponseCache cache)
    {
        _db = db;
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
        var row = await _db.FinancialReportConfigs
            .FirstOrDefaultAsync(x => x.Id == SingletonId, cancellationToken);
        var now = DateTime.UtcNow;

        if (row is null)
        {
            row = new FinancialReportConfig
            {
                Id = SingletonId,
                ReportJson = payload,
                UpdatedAtUtc = now,
            };
            _db.FinancialReportConfigs.Add(row);
        }
        else
        {
            row.ReportJson = payload;
            row.UpdatedAtUtc = now;
        }

        await _db.SaveChangesAsync(cancellationToken);
        await _cache.RemoveAsync(CacheKeys.FinancialSummary, cancellationToken);
        return request;
    }

    private async Task<FinancialSummaryDto> BuildFromDatabaseAsync(CancellationToken cancellationToken)
    {
        var completedLedgers = CompletedCaseStudyLedgers();
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

        var enfazRevenueTotal = await _db.PoEnfazRevenueLines.AsNoTracking()
            .Where(l => l.IncludedInBilling
                && l.CaseStudyFeeSar + l.SurveyFeeSar > 0)
            .SumAsync(
                l => (decimal?)(l.CaseStudyFeeSar + l.SurveyFeeSar),
                cancellationToken) ?? 0m;
        var keyReceiptSummary = await _db.KeyReceiptFeeCharges.AsNoTracking()
            .GroupBy(_ => 1)
            .Select(group => new
            {
                Total = group.Sum(c => c.AmountSar),
                Collected = group.Count(c =>
                    c.CollectionStatus == KeyReceiptFeeStatuses.Collected),
                Count = group.Count(),
            })
            .SingleOrDefaultAsync(cancellationToken);
        var visitFeeSummary = await _db.CourtVisitFeeCharges.AsNoTracking()
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
        var revenueTotal = enfazRevenueTotal + keyReceiptTotal;
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

        if (keyReceiptTotal > 0)
        {
            revenueRows.Add(new FinancialRevenueRowDto
            {
                Po = "أتعاب استلام مفاتيح",
                Billed = keyReceiptSummary!.Collected,
                Excluded = keyReceiptSummary.Count - keyReceiptSummary.Collected,
                Value = FormatSar(keyReceiptTotal),
                Status = keyReceiptSummary.Collected == keyReceiptSummary.Count
                    ? "done"
                    : "progress",
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

    private IQueryable<InspectorFeeLedger> CompletedCaseStudyLedgers()
    {
        return _db.InspectorFeeLedgers.AsNoTracking()
            .Where(ledger =>
                ledger.PropertyId != null
                && _db.WorkflowTasks.Any(task =>
                    task.Kind == WorkflowTaskKind.CaseStudyProperty
                    && task.PropertyId == ledger.PropertyId
                    && task.Status == WorkflowTaskStatus.Completed));
    }

    private async Task<Dictionary<string, string>> LoadAssigneeNamesAsync(
        IReadOnlyList<string> assigneeIds,
        CancellationToken cancellationToken)
    {
        if (assigneeIds.Count == 0)
            return new Dictionary<string, string>(StringComparer.Ordinal);

        var profiles = await (
            from profile in _db.UserProfiles.AsNoTracking()
            join user in _db.Users.AsNoTracking() on profile.UserId equals user.Id
            where profile.DistributionAssigneeId != null
                && assigneeIds.Contains(profile.DistributionAssigneeId)
            select new
            {
                AssigneeId = profile.DistributionAssigneeId!,
                user.DisplayName,
            }).ToListAsync(cancellationToken);

        var map = profiles
            .ToDictionary(p => p.AssigneeId, p => p.DisplayName, StringComparer.Ordinal);

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
        var aggregates = await (
            from ledger in completedLedgers
            join task in _db.WorkflowTasks.AsNoTracking()
                on ledger.WorkflowTaskId equals task.Id into taskGroup
            from task in taskGroup.DefaultIfEmpty()
            let assigneeId = ledger.AssigneeId == null || ledger.AssigneeId.Trim() == ""
                ? "—"
                : ledger.AssigneeId.Trim()
            group ledger by new
            {
                AssigneeId = assigneeId!,
                ledger.InspectorType,
                Kind = task == null ? null : (WorkflowTaskKind?)task.Kind,
            }
            into grouped
            select new
            {
                grouped.Key.AssigneeId,
                grouped.Key.InspectorType,
                grouped.Key.Kind,
                Total = grouped.Sum(l => l.AgreedFeeSar - l.SupervisorDiscountSar),
                Count = grouped.Count(),
            }).ToListAsync(cancellationToken);

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
                    Category = CategoryLabel(dominantKind),
                };
            })
            .OrderBy(r => r.Name, StringComparer.Ordinal)
            .ToList();
    }

    private async Task<List<FinancialRevenueRowDto>> BuildRevenueRowsAsync(
        IQueryable<InspectorFeeLedger> completedLedgers,
        CancellationToken cancellationToken)
    {
        var orders = await _db.WorkOrders.AsNoTracking()
            .OrderByDescending(w => w.CreatedAtUtc)
            .ThenBy(w => w.PoNumber)
            .Select(w => new
            {
                PoNumber = w.PoNumber.Trim(),
                PropertyCount = w.Properties.Count,
            })
            .ToListAsync(cancellationToken);

        if (orders.Count == 0)
            return [];

        var enfazByPo = await _db.PoEnfazRevenueLines.AsNoTracking()
            .GroupBy(x => x.PoNumber)
            .Select(g => new
            {
                PoNumber = g.Key,
                Total = g.Where(x => x.IncludedInBilling)
                    .Sum(x => x.CaseStudyFeeSar + x.SurveyFeeSar),
                Filled = g.Count(x =>
                    x.IncludedInBilling && (x.CaseStudyFeeSar + x.SurveyFeeSar) > 0),
            })
            .ToDictionaryAsync(x => x.PoNumber.Trim(), x => x, StringComparer.Ordinal, cancellationToken);

        var invoicesByPo = await _db.PoEnfazInvoices.AsNoTracking()
            .ToDictionaryAsync(x => x.PoNumber.Trim(), x => x.InvoiceNumber, StringComparer.Ordinal, cancellationToken);
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
            var enfazTotal = enfaz?.Total ?? 0m;
            var enfazFilled = enfaz?.Filled ?? 0;

            rows.Add(new FinancialRevenueRowDto
            {
                Po = po,
                Billed = enfazFilled > 0 ? enfazFilled : disbursed,
                Excluded = excluded,
                Value = enfazTotal > 0 ? FormatSar(enfazTotal) : "—",
                Status = enfazTotal > 0 && enfazFilled >= propertyCount
                    ? "done"
                    : enfazFilled > 0
                        ? "progress"
                        : "progress",
                InvoiceNumber = invoicesByPo.GetValueOrDefault(po),
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

    private static string CategoryLabel(WorkflowTaskKind? kind) => kind switch
    {
        WorkflowTaskKind.FieldInspection => "معاينة",
        WorkflowTaskKind.EngineeringSurvey => "رفع مساحي",
        WorkflowTaskKind.GovernmentReview => "مراجعة حكومية",
        WorkflowTaskKind.PropertyAppraisal => "تقييم",
        _ => "أخرى",
    };

    private static string FormatSar(decimal amount) =>
        $"{amount.ToString("N0", ArCulture)} ر.س";

    private static string MarginPercentLabel(decimal revenue, decimal margin)
    {
        if (revenue <= 0) return "—";
        var pct = (int)Math.Round(margin / revenue * 100m, MidpointRounding.AwayFromZero);
        return $"{pct}% من الإيرادات";
    }

    private static string CurrentPeriodLabel()
    {
        var now = DateTime.UtcNow;
        return now.ToString("MMMM yyyy", ArCulture);
    }
}
