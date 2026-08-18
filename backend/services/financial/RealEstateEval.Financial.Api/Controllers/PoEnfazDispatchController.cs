using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Web;

namespace RealEstateEval.Financial.Api.Controllers;

[ApiController]
[Route("api/financial-dispatch/enfaz-billing")]
[Authorize]
public sealed class PoEnfazDispatchController(IPoEnfazBillingService billing) : ControllerBase
{
    [HttpGet("ready-pos-summary")]
    public async Task<ActionResult<IReadOnlyList<EnfazReadyPoSummaryDto>>> ReadyPos(
        CancellationToken cancellationToken) =>
        Ok(await billing.ListReadyPoSummariesAsync(cancellationToken));

    [HttpGet("tracking")]
    public async Task<ActionResult<IReadOnlyList<EnfazTrackingRowDto>>> Tracking(
        CancellationToken cancellationToken) =>
        Ok(await billing.ListTrackingAsync(cancellationToken));

    [HttpGet("aging")]
    public async Task<ActionResult<EnfazAgingReportDto>> Aging(
        CancellationToken cancellationToken) =>
        Ok(await billing.GetAgingReportAsync(cancellationToken));

    [HttpGet("{poNumber}")]
    public async Task<ActionResult<PoEnfazBillingDto>> Get(
        string poNumber,
        CancellationToken cancellationToken)
    {
        var dto = await billing.GetPoBillingAsync(poNumber, cancellationToken);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPut("{poNumber}")]
    public async Task<ActionResult<PoEnfazBillingDto>> Save(
        string poNumber,
        [FromBody] SavePoEnfazBillingRequest request,
        CancellationToken cancellationToken)
    {
        var dto = await billing.SavePoBillingAsync(poNumber, request, cancellationToken);
        return dto is null
            ? this.BadRequestProblem("تعذر حفظ أتعاب إنفاذ.")
            : Ok(dto);
    }

    [HttpGet("{poNumber}/properties/{propertyId:guid}")]
    public async Task<ActionResult<PropertyEnfazRevenueDto>> PropertyRevenue(
        string poNumber,
        Guid propertyId,
        CancellationToken cancellationToken) =>
        Ok(await billing.GetPropertyRevenueAsync(poNumber, propertyId, cancellationToken)
            ?? new PropertyEnfazRevenueDto());

    [HttpPost("{poNumber}/issue-invoice")]
    public async Task<ActionResult<PoEnfazBillingDto>> Issue(
        string poNumber,
        CancellationToken cancellationToken)
    {
        var dto = await billing.IssueInvoiceAsync(poNumber, cancellationToken);
        return dto is null
            ? this.BadRequestProblem(
                "تعذر إصدار الفاتورة — تحقق من اكتمال أمر العمل وتعبئة الأتعاب.")
            : Ok(dto);
    }

    [HttpPost("{poNumber}/collect")]
    public async Task<ActionResult<PoEnfazBillingDto>> Collect(
        string poNumber,
        [FromBody] CollectPoEnfazInvoiceDispatchRequest request,
        CancellationToken cancellationToken)
    {
        var (dto, error) = await billing.CollectInvoiceAsync(
            poNumber, request.Collect, request.ActorUserId, cancellationToken);
        if (error is not null)
            return this.BadRequestProblem(error);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpGet("{poNumber}/invoice.pdf")]
    public async Task<IActionResult> InvoicePdf(string poNumber, CancellationToken cancellationToken)
    {
        var pdf = await billing.GetInvoicePdfAsync(poNumber, cancellationToken);
        return pdf is null
            ? this.NotFoundProblem("لا توجد فاتورة صادرة لهذا أمر العمل.")
            : File(pdf, "application/pdf");
    }

    [HttpGet("{poNumber}/followups")]
    public async Task<ActionResult<IReadOnlyList<EnfazFollowupDto>>> Followups(
        string poNumber,
        CancellationToken cancellationToken) =>
        Ok(await billing.ListFollowupsAsync(poNumber, cancellationToken));

    [HttpPost("{poNumber}/followups")]
    public async Task<ActionResult<EnfazFollowupDto>> AddFollowup(
        string poNumber,
        [FromBody] AddEnfazFollowupDispatchRequest request,
        CancellationToken cancellationToken)
    {
        var (dto, error) = await billing.AddFollowupAsync(
            poNumber, request.Followup, request.ActorUserId, cancellationToken);
        if (error is not null)
            return this.BadRequestProblem(error);
        return dto is null ? this.BadRequestProblem("تعذر حفظ المتابعة.") : Ok(dto);
    }

    [HttpPost("{poNumber}/finance-flag")]
    public async Task<IActionResult> SetFlag(
        string poNumber,
        [FromBody] SetEnfazFinanceFlagDispatchRequest request,
        CancellationToken cancellationToken)
    {
        var (ok, error) = await billing.SetFinanceFlagAsync(
            poNumber, request.Flag, request.ActorUserId, cancellationToken);
        return ok ? NoContent() : this.BadRequestProblem(error ?? "تعذر تعيين العلامة.");
    }

    [HttpDelete("{poNumber}/finance-flag")]
    public async Task<IActionResult> ClearFlag(
        string poNumber,
        [FromQuery] string? propertyId,
        CancellationToken cancellationToken)
    {
        var (ok, error) = await billing.ClearFinanceFlagAsync(poNumber, propertyId, cancellationToken);
        return ok ? NoContent() : this.BadRequestProblem(error ?? "تعذر مسح العلامة.");
    }
}
