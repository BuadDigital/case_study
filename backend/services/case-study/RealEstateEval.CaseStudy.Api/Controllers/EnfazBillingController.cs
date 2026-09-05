using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Shared.Web;
using RealEstateEval.Shared.Web.Authorization;

namespace RealEstateEval.CaseStudy.Api.Controllers;

[ApiController]
[Route("api/enfaz-billing")]
[Authorize]
public class EnfazBillingController : ControllerBase
{
    private readonly IPoEnfazBillingService _billing;
    private readonly DatabaseOptions _dbOptions;

    public EnfazBillingController(
        IPoEnfazBillingService billing,
        IOptions<DatabaseOptions>? dbOptions = null)
    {
        _billing = billing;
        _dbOptions = dbOptions?.Value ?? new DatabaseOptions();
    }

 /// <summary>
 /// Work orders ready for an Enfaz invoice. Sending page or pageSize returns PagedResultDto;
 /// without them the response stays the plain array. See
 /// docs/architecture/pagination-contract.md §10.1.
 /// </summary>
    [HttpGet("ready-pos-summary")]
    [Authorize(Policy = CapabilityPolicyNames.ReadFinancialData)]
    public async Task<IActionResult> ListReadyPosSummary(
        [FromQuery] int? page = null,
        [FromQuery] int? pageSize = null,
        [FromQuery] string? sort = null,
        [FromQuery] string? dir = null,
        [FromQuery] string? q = null,
        CancellationToken ct = default)
    {
        var query = new EnfazReadyPoListQuery
        {
            Page = page,
            PageSize = pageSize,
            Sort = sort,
            Dir = dir,
            Q = q,
        };

        if (!query.IsPaged)
            return Ok(await _billing.ListReadyPoSummariesAsync(query, ct));

        var (skip, take, resolvedPage, _) = NpgsqlConfiguration.ResolveListPaging(
            query.Page, query.PageSize, _dbOptions);
        return Ok(await _billing.ListReadyPoSummariesPagedAsync(query, skip, take, resolvedPage, ct));
    }

    [HttpGet("{poNumber}")]
    [Authorize(Policy = CapabilityPolicyNames.ReadFinancialData)]
    public async Task<ActionResult<PoEnfazBillingDto>> GetPo(string poNumber, CancellationToken ct)
    {
        var dto = await _billing.GetPoBillingAsync(poNumber, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPut("{poNumber}")]
    [Authorize(Policy = CapabilityPolicyNames.ManageFinancial)]
    public async Task<ActionResult<PoEnfazBillingDto>> SavePo(
        string poNumber,
        [FromBody] SavePoEnfazBillingRequest request,
        CancellationToken ct)
    {
        var dto = await _billing.SavePoBillingAsync(poNumber, request, ct);
        return dto is null
            ? this.BadRequestProblem("تعذر حفظ أتعاب إنفاذ.")
            : Ok(dto);
    }

 /// <summary>
 /// Per-property tracking rows. Sending page or pageSize returns PagedResultDto; without them the
 /// response stays the plain array (capped at 2000 as before). See
 /// docs/architecture/pagination-contract.md §10.2.
 /// </summary>
    [HttpGet("tracking")]
    [Authorize(Policy = CapabilityPolicyNames.ReadFinancialData)]
    public async Task<IActionResult> Tracking(
        [FromQuery] int? page = null,
        [FromQuery] int? pageSize = null,
        [FromQuery] string? sort = null,
        [FromQuery] string? dir = null,
        [FromQuery] string? q = null,
        CancellationToken ct = default)
    {
        var query = new EnfazTrackingListQuery
        {
            Page = page,
            PageSize = pageSize,
            Sort = sort,
            Dir = dir,
            Q = q,
        };

        if (!query.IsPaged)
            return Ok(await _billing.ListTrackingAsync(query, ct));

        var (skip, take, resolvedPage, _) = NpgsqlConfiguration.ResolveListPaging(
            query.Page, query.PageSize, _dbOptions);
        return Ok(await _billing.ListTrackingPagedAsync(query, skip, take, resolvedPage, ct));
    }

    [HttpGet("aging")]
    [Authorize(Policy = CapabilityPolicyNames.ReadFinancialData)]
    public async Task<ActionResult<EnfazAgingReportDto>> Aging(CancellationToken ct) => Ok(await _billing.GetAgingReportAsync(ct));

    [HttpPost("{poNumber}/issue-invoice")]
    [Authorize(Policy = CapabilityPolicyNames.ManageFinancial)]
    public async Task<ActionResult<PoEnfazBillingDto>> IssueInvoice(
        string poNumber,
        CancellationToken ct)
    {
        var dto = await _billing.IssueInvoiceAsync(poNumber, ct);
        return dto is null
            ? this.BadRequestProblem(
                "تعذر إصدار الفاتورة — تحقق من اكتمال أمر العمل وتعبئة الأتعاب.")
            : Ok(dto);
    }

    [HttpPost("{poNumber}/collect")]
    [Authorize(Policy = CapabilityPolicyNames.ManageFinancial)]
    public async Task<ActionResult<PoEnfazBillingDto>> Collect(
        string poNumber,
        [FromBody] CollectPoEnfazInvoiceRequest request,
        CancellationToken ct)
    {
        var (dto, error) = await _billing.CollectInvoiceAsync(
            poNumber,
            request,
            ActorClaims.Id(User),
            ct);
        if (error is not null)
            return this.BadRequestProblem(error);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpGet("{poNumber}/invoice.pdf")]
    [Authorize(Policy = CapabilityPolicyNames.ManageFinancial)]
    public async Task<IActionResult> DownloadInvoicePdf(string poNumber, CancellationToken ct)
    {
        var pdf = await _billing.GetInvoicePdfAsync(poNumber, ct);
        if (pdf is null)
            return this.NotFoundProblem("لا توجد فاتورة صادرة لهذا أمر العمل.");

        var safePo = poNumber.Trim().Replace('"', '_');
        return File(pdf, "application/pdf", $"enfaz-invoice-{safePo}.pdf");
    }

    [HttpGet("{poNumber}/properties/{propertyId:guid}")]
    [Authorize(Policy = CapabilityPolicyNames.ReadFinancialData)]
    public async Task<ActionResult<PropertyEnfazRevenueDto>> GetPropertyRevenue(
        string poNumber,
        Guid propertyId,
        CancellationToken ct) =>
        Ok(await _billing.GetPropertyRevenueAsync(poNumber, propertyId, ct)
            ?? new PropertyEnfazRevenueDto());

    [HttpGet("{poNumber}/followups")]
    [Authorize(Policy = CapabilityPolicyNames.ReadFinancialData)]
    public async Task<ActionResult<IReadOnlyList<EnfazFollowupDto>>> ListFollowups(
        string poNumber,
        CancellationToken ct) =>
        Ok(await _billing.ListFollowupsAsync(poNumber, ct));

    [HttpPost("{poNumber}/followups")]
    [Authorize(Policy = CapabilityPolicyNames.ManageFinancial)]
    public async Task<ActionResult<EnfazFollowupDto>> AddFollowup(
        string poNumber,
        [FromBody] AddEnfazFollowupRequest request,
        CancellationToken ct)
    {
        var (dto, error) = await _billing.AddFollowupAsync(
            poNumber,
            request,
            ActorClaims.Id(User),
            ct);
        if (error is not null)
            return this.BadRequestProblem(error);
        return dto is null ? this.BadRequestProblem("تعذر حفظ المتابعة.") : Ok(dto);
    }

    [HttpPost("{poNumber}/finance-flag")]
    [Authorize(Policy = CapabilityPolicyNames.ManageFinancial)]
    public async Task<IActionResult> SetFinanceFlag(
        string poNumber,
        [FromBody] SetEnfazFinanceFlagRequest request,
        CancellationToken ct)
    {
        var (ok, error) = await _billing.SetFinanceFlagAsync(
            poNumber,
            request,
            ActorClaims.Id(User),
            ct);
        if (!ok)
            return this.BadRequestProblem(error ?? "تعذر تعيين العلامة.");
        return NoContent();
    }

    [HttpDelete("{poNumber}/finance-flag")]
    [Authorize(Policy = CapabilityPolicyNames.ManageFinancial)]
    public async Task<IActionResult> ClearFinanceFlag(
        string poNumber,
        [FromQuery] string? propertyId,
        CancellationToken ct)
    {
        var (ok, error) = await _billing.ClearFinanceFlagAsync(poNumber, propertyId, ct);
        if (!ok)
            return this.BadRequestProblem(error ?? "تعذر مسح العلامة.");
        return NoContent();
    }
}
