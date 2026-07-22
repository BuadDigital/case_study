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
        var ledgers = await _db.InspectorFeeLedgers.AsNoTracking().ToListAsync(cancellationToken);
        ledgers = await FilterLedgersWithCompletedCaseStudyAsync(ledgers, cancellationToken);

        var taskIds = ledgers.Select(l => l.WorkflowTaskId).Distinct().ToList();
        var tasks = taskIds.Count == 0
            ? new Dictionary<Guid, WorkflowTask>()
            : await _db.WorkflowTasks.AsNoTracking()
                .Where(t => taskIds.Contains(t.Id))
                .ToDictionaryAsync(t => t.Id, cancellationToken);

        var assigneeIds = ledgers
            .Select(l => l.AssigneeId?.Trim())
            .Where(id => !string.IsNullOrEmpty(id))
            .Select(id => id!)
            .Distinct(StringComparer.Ordinal)
            .ToList();

        var nameByAssigneeId = await LoadAssigneeNamesAsync(assigneeIds, cancellationToken);

        var costRows = BuildCostRows(ledgers, tasks, nameByAssigneeId);
        var revenueRows = await BuildRevenueRowsAsync(ledgers, cancellationToken);

        var externalCosts = ledgers
            .Where(l => !string.Equals(l.InspectorType, "موظف", StringComparison.Ordinal))
            .Sum(l => NetFee(l));
        var pendingPayables = ledgers
            .Where(l => l.BillingStatus is InspectorFeeBillingStatus.AtFinance
                or InspectorFeeBillingStatus.DisbReq)
            .Sum(l => NetFee(l));

        var enfazLines = await _db.PoEnfazRevenueLines.AsNoTracking().ToListAsync(cancellationToken);
        var keyReceiptFees = await _db.KeyReceiptFeeCharges.AsNoTracking().ToListAsync(cancellationToken);
        var visitFees = await _db.CourtVisitFeeCharges.AsNoTracking().ToListAsync(cancellationToken);
        var keyReceiptTotal = keyReceiptFees.Sum(c => c.AmountSar);
        var visitFeeTotal = visitFees.Sum(c => c.AmountSar);
        var revenueTotal = enfazLines
            .Where(l => l.IncludedInBilling && l.TotalFeeSar > 0)
            .Sum(l => l.TotalFeeSar) + keyReceiptTotal;
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
                Billed = keyReceiptFees.Count(c => c.CollectionStatus == KeyReceiptFeeStatuses.Collected),
                Excluded = keyReceiptFees.Count(c => c.CollectionStatus != KeyReceiptFeeStatuses.Collected),
                Value = FormatSar(keyReceiptTotal),
                Status = keyReceiptFees.All(c => c.CollectionStatus == KeyReceiptFeeStatuses.Collected)
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
            PendingPayablesTotal = FormatSar(pendingPayables + visitFees
                .Where(c => c.Status == CourtVisitFeeStatuses.Open)
                .Sum(c => c.AmountSar)),
            RevenueGrandTotal = FormatSar(revenueTotal),
            RevenueRows = revenueRows,
            CostRows = costRows,
        };
    }

    private async Task<List<InspectorFeeLedger>> FilterLedgersWithCompletedCaseStudyAsync(
        List<InspectorFeeLedger> ledgers,
        CancellationToken cancellationToken)
    {
        if (ledgers.Count == 0) return ledgers;

        var propertyIds = ledgers
            .Where(l => l.PropertyId.HasValue)
            .Select(l => l.PropertyId!.Value)
            .Distinct()
            .ToList();
        if (propertyIds.Count == 0) return [];

        var ready = await _db.WorkflowTasks.AsNoTracking()
            .Where(t =>
                t.Kind == "case-study-property"
                && t.PropertyId != null
                && propertyIds.Contains(t.PropertyId.Value)
                && t.Status == WorkflowTaskStatus.Completed)
            .Select(t => t.PropertyId!.Value)
            .Distinct()
            .ToListAsync(cancellationToken);
        var readySet = ready.ToHashSet();

        return ledgers
            .Where(l => l.PropertyId is Guid pid && readySet.Contains(pid))
            .ToList();
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
            select new
            {
                AssigneeId = profile.DistributionAssigneeId!,
                user.DisplayName,
            }).ToListAsync(cancellationToken);

        var map = profiles
            .Where(p => assigneeIds.Contains(p.AssigneeId, StringComparer.Ordinal))
            .ToDictionary(p => p.AssigneeId, p => p.DisplayName, StringComparer.Ordinal);

        foreach (var id in assigneeIds)
        {
            if (map.ContainsKey(id)) continue;
            map[id] = id;
        }

        return map;
    }

    private static List<FinancialCostRowDto> BuildCostRows(
        IReadOnlyList<InspectorFeeLedger> ledgers,
        IReadOnlyDictionary<Guid, WorkflowTask> tasks,
        IReadOnlyDictionary<string, string> nameByAssigneeId)
    {
        return ledgers
            .GroupBy(l => l.AssigneeId?.Trim() ?? "—", StringComparer.Ordinal)
            .Select(group =>
            {
                var assigneeId = group.Key;
                var name = assigneeId == "—"
                    ? "غير مسند"
                    : nameByAssigneeId.GetValueOrDefault(assigneeId, assigneeId);
                var total = group.Sum(NetFee);
                var dominantKind = group
                    .Select(l => tasks.TryGetValue(l.WorkflowTaskId, out var t) ? t.Kind : null)
                    .Where(k => !string.IsNullOrWhiteSpace(k))
                    .GroupBy(k => k!)
                    .OrderByDescending(g => g.Count())
                    .Select(g => g.Key)
                    .FirstOrDefault();
                var inspectorType = group
                    .GroupBy(l => l.InspectorType)
                    .OrderByDescending(g => g.Count())
                    .Select(g => g.Key)
                    .FirstOrDefault() ?? "موظف";

                return new FinancialCostRowDto
                {
                    Name = name,
                    Type = CostTypeCode(inspectorType),
                    Cost = FormatSar(total),
                    Category = CategoryLabel(dominantKind),
                };
            })
            .OrderBy(r => r.Name, StringComparer.Ordinal)
            .ToList();
    }

    private async Task<List<FinancialRevenueRowDto>> BuildRevenueRowsAsync(
        IReadOnlyList<InspectorFeeLedger> ledgers,
        CancellationToken cancellationToken)
    {
        var orders = await _db.WorkOrders.AsNoTracking()
            .Include(w => w.Properties)
            .OrderByDescending(w => w.CreatedAtUtc)
            .ThenBy(w => w.PoNumber)
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

        var rows = new List<FinancialRevenueRowDto>();
        foreach (var order in orders)
        {
            var po = order.PoNumber.Trim();
            var propertyCount = order.Properties.Count;
            var poLedgers = ledgers.Where(l => l.PoNumber.Trim() == po).ToList();
            var disbursed = poLedgers.Count(l =>
                l.BillingStatus == InspectorFeeBillingStatus.Disbursed);
            var tracked = poLedgers.Count;
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

    private static decimal NetFee(InspectorFeeLedger ledger) =>
        InspectorFeeRules.NetFee(ledger.AgreedFeeSar, ledger.SupervisorDiscountSar);

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

    private static string CategoryLabel(string? kind) => kind switch
    {
        "field-inspection" => "معاينة",
        "engineering-survey" => "رفع مساحي",
        "government-review" => "مراجعة حكومية",
        "property-appraisal" => "تقييم",
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
