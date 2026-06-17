using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Caching;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Financial.Api.Controllers;

[ApiController]
[Route("api/financial/v1")]
[Authorize]
public class FinancialController : ControllerBase
{
    private static readonly Guid SingletonId = Guid.Parse("f1a2b3c4-d5e6-7890-abcd-ef1234567890");
    private readonly ApplicationDbContext _db;
    private readonly ApiResponseCache _cache;

    public FinancialController(ApplicationDbContext db, ApiResponseCache cache)
    {
        _db = db;
        _cache = cache;
    }

    [HttpGet("summary")]
    public async Task<ActionResult<FinancialSummaryDto>> Summary(CancellationToken ct)
    {
        var summary = await _cache.GetOrCreateAsync(
            CacheKeys.FinancialSummary,
            CacheDurations.Financial,
            async cancellationToken =>
            {
                var row = await _db.FinancialReportConfigs.AsNoTracking()
                    .FirstOrDefaultAsync(x => x.Id == SingletonId, cancellationToken);
                return row is null ? DefaultSummary() : Deserialize(row.ReportJson);
            },
            ct);
        return Ok(summary);
    }

    [HttpPut("summary")]
    public async Task<ActionResult<FinancialSummaryDto>> Save(
        [FromBody] FinancialSummaryDto request,
        CancellationToken ct)
    {
        var payload = JsonSerializer.Serialize(request);
        var row = await _db.FinancialReportConfigs
            .FirstOrDefaultAsync(x => x.Id == SingletonId, ct);
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

        await _db.SaveChangesAsync(ct);
        await _cache.RemoveAsync(CacheKeys.FinancialSummary, ct);
        return Ok(Deserialize(row.ReportJson));
    }

    private static FinancialSummaryDto Deserialize(string json)
    {
        try
        {
            return JsonSerializer.Deserialize<FinancialSummaryDto>(json, JsonOptions)
                ?? DefaultSummary();
        }
        catch
        {
            return DefaultSummary();
        }
    }

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    private static FinancialSummaryDto DefaultSummary() => new()
    {
        PeriodLabel = "يناير",
        RevenueTotal = "312,400",
        ExternalCostsTotal = "87,600",
        ProfitMarginTotal = "224,800",
        ProfitMarginPercentLabel = "72% من الإيرادات",
        PendingPayablesTotal = "43,200",
        RevenueGrandTotal = "55,800 ر",
        RevenueRows =
        [
            new FinancialRevenueRowDto
            {
                Po = "PO-2024-014",
                Billed = 8,
                Excluded = 0,
                Value = "18,400 ر",
                Status = "done",
            },
            new FinancialRevenueRowDto
            {
                Po = "PO-2024-015",
                Billed = 1,
                Excluded = 0,
                Value = "2,200 ر",
                Status = "done",
            },
            new FinancialRevenueRowDto
            {
                Po = "PO-2024-017",
                Billed = 3,
                Excluded = 0,
                Value = "6,600 ر",
                Status = "done",
            },
            new FinancialRevenueRowDto
            {
                Po = "PO-2024-016",
                Billed = 13,
                Excluded = 2,
                Value = "28,600 ر",
                Status = "progress",
            },
        ],
        CostRows =
        [
            new FinancialCostRowDto
            {
                Name = "مكتب الرياض الهندسي",
                Type = "ext",
                Cost = "18,400 ر",
                Category = "رفع مساحي",
            },
            new FinancialCostRowDto
            {
                Name = "عبدالله الكثيري",
                Type = "int",
                Cost = "12,000 ر",
                Category = "تقييم",
            },
            new FinancialCostRowDto
            {
                Name = "حسن عطية",
                Type = "free",
                Cost = "3,200 ر",
                Category = "معاينة",
            },
        ],
    };
}
