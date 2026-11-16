using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Shared.Web;
using RealEstateEval.Shared.Web.Authorization;
using RealEstateEval.Valuation.Application.Abstractions;
using RealEstateEval.Valuation.Application.Contracts;

namespace RealEstateEval.Valuation.Api.Controllers;

/// <summary>
/// «استيراد تقارير التقييم» — the periodic Excel export of an external valuation program, previewed
/// then committed (replace on the same report number, never delete), and the reports served to the
/// «خريطة العقارات» layer.
/// </summary>
[ApiController]
[Route("api/valuation-report-imports")]
[Authorize]
public class ValuationReportImportsController(IValuationReportImportService imports) : ControllerBase
{
    /// <summary>Same ceiling as the gateway: a full export runs to tens of MB once base64-encoded.</summary>
    private const long UploadLimitBytes = 80L * 1024 * 1024;

    [HttpGet("sources")]
    [Authorize(Policy = CapabilityPolicyNames.ImportValuationReports)]
    public ActionResult<IReadOnlyList<ValuationReportSourceDto>> Sources() => Ok(imports.Sources());

    [HttpGet("batches")]
    [Authorize(Policy = CapabilityPolicyNames.ImportValuationReports)]
    public async Task<ActionResult<IReadOnlyList<ValuationReportImportBatchDto>>> Batches(CancellationToken ct) =>
        Ok(await imports.ListBatchesAsync(ct));

    [HttpPost("preview")]
    [Authorize(Policy = CapabilityPolicyNames.ImportValuationReports)]
    [RequestSizeLimit(UploadLimitBytes)]
    public async Task<IActionResult> Preview([FromBody] ValuationReportImportRequest request, CancellationToken ct)
    {
        var (result, error) = await imports.PreviewAsync(request, ct);
        return result is null ? this.BadRequestProblem(error ?? "تعذّر قراءة الملف.") : Ok(result);
    }

    [HttpPost]
    [Authorize(Policy = CapabilityPolicyNames.ImportValuationReports)]
    [RequestSizeLimit(UploadLimitBytes)]
    public async Task<IActionResult> Commit([FromBody] ValuationReportImportRequest request, CancellationToken ct)
    {
        var (result, error) = await imports.CommitAsync(
            request,
            ActorClaims.Id(User),
            ActorClaims.DisplayName(User),
            ct);
        return result is null ? this.BadRequestProblem(error ?? "تعذّر تنفيذ الاستيراد.") : Ok(result);
    }

    [HttpGet("map-points")]
    [Authorize(Policy = CapabilityPolicyNames.ReadComparableBank)]
    public async Task<ActionResult<IReadOnlyList<ValuationReportMapPointDto>>> MapPoints(CancellationToken ct) =>
        Ok(await imports.ListMapPointsAsync(ct));

    [HttpGet("{source}/{reportNumber}")]
    [Authorize(Policy = CapabilityPolicyNames.ReadComparableBank)]
    public async Task<ActionResult<ValuationReportDetailDto>> Get(string source, string reportNumber, CancellationToken ct)
    {
        var dto = await imports.GetAsync(source, reportNumber, ct);
        return dto is null ? NotFound() : Ok(dto);
    }
}
