using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Shared.Web;

namespace RealEstateEval.Financial.Api.Controllers;

[ApiController]
[Route("api/financial-dispatch")]
[Authorize]
[RequireUpstreamDispatch]
public sealed class FinancialChargesDispatchController(
    ICourtVisitFeeChargeService courtVisitFees,
    IKeyReceiptFeeChargeService keyReceiptFees,
    IPartyFeePricingService pricing,
    IPoEnfazInvoiceLookup enfazInvoices) : ControllerBase
{
    [HttpGet("court-visit-charges")]
    public async Task<ActionResult<IReadOnlyList<CourtVisitFeeReportRowDto>>> ListCourtVisit(
        [FromQuery] string? creditAssigneeId,
        CancellationToken cancellationToken) =>
        Ok(await courtVisitFees.ListAsync(creditAssigneeId, cancellationToken));

    [HttpGet("court-visit-charges/exists")]
    public async Task<ActionResult<ExistsResponseDto>> CourtVisitExists(
        [FromQuery] Guid operationsTaskId,
        CancellationToken cancellationToken) =>
        Ok(new ExistsResponseDto
        {
            Exists = await courtVisitFees.ExistsForTaskAsync(operationsTaskId, cancellationToken),
        });

    [HttpGet("court-visit-charges/charged-task-ids")]
    public async Task<ActionResult<IReadOnlyList<Guid>>> ChargedTaskIds(
        CancellationToken cancellationToken) =>
        Ok(await courtVisitFees.ListChargedTaskIdsAsync(cancellationToken));

    [HttpPost("court-visit-charges")]
    public async Task<IActionResult> AddCourtVisit(
        [FromBody] CreateCourtVisitFeeChargeRequest request,
        CancellationToken cancellationToken)
    {
        await courtVisitFees.AddChargeAsync(request, cancellationToken);
        return NoContent();
    }

    [HttpPost("court-visit-charges/amounts")]
    public async Task<ActionResult<IReadOnlyList<CourtVisitFeeAmountDto>>> CourtVisitAmounts(
        [FromBody] GuidListRequest request,
        CancellationToken cancellationToken)
    {
        var map = await courtVisitFees.GetAmountsByTaskIdsAsync(request.Ids, cancellationToken);
        return Ok(map.Select(entry => new CourtVisitFeeAmountDto
        {
            OperationsTaskId = entry.Key,
            AmountSar = entry.Value ?? 0m,
        }).ToList());
    }

    [HttpGet("key-receipt-charges")]
    public async Task<ActionResult<IReadOnlyList<KeyReceiptFeeChargeDto>>> ListKeyReceipt(
        CancellationToken cancellationToken) =>
        Ok(await keyReceiptFees.ListAsync(cancellationToken));

    [HttpDelete("key-receipt-charges/{envelopeId:guid}")]
    public async Task<IActionResult> DeleteKeyReceipt(
        Guid envelopeId,
        CancellationToken cancellationToken)
    {
        await keyReceiptFees.DeleteForEnvelopeAsync(envelopeId, cancellationToken);
        return NoContent();
    }

    [HttpPost("key-receipt-charges/{envelopeId:guid}/collect")]
    public async Task<ActionResult<KeyReceiptFeeChargeDto>> CollectKeyReceipt(
        Guid envelopeId,
        [FromBody] MarkKeyReceiptFeeCollectedRequest? request,
        CancellationToken cancellationToken)
    {
        var (row, error) = await keyReceiptFees.MarkCollectedAsync(
            envelopeId, request?.InvoiceReference, cancellationToken);
        if (error is not null)
            return this.BadRequestProblem(error);
        return row is null ? NotFound() : Ok(row);
    }

    [HttpPost("key-receipt-charges/enfaz-lines")]
    public async Task<ActionResult<IReadOnlyList<PoEnfazKeyRevenueLineDto>>> KeyEnfazLines(
        [FromBody] GuidListRequest request,
        CancellationToken cancellationToken) =>
        Ok(await keyReceiptFees.ListKeyRevenueLinesAsync(request.Ids, cancellationToken));

    [HttpPost("key-receipt-charges/enfaz-invoices")]
    public async Task<ActionResult<IReadOnlyDictionary<string, PoEnfazInvoiceRefDto>>> KeyEnfazInvoices(
        [FromBody] StringListRequest request,
        CancellationToken cancellationToken) =>
        Ok(await keyReceiptFees.GetInvoicesByPoAsync(request.Values, cancellationToken));

    [HttpGet("party-fee-pricing/resolve")]
    public async Task<ActionResult<ResolvedPartyFeeDto>> ResolvePricing(
        [FromQuery] WorkflowTaskKind taskKind,
        [FromQuery] string partyType,
        [FromQuery] decimal? areaM2,
        [FromQuery] string? assigneeId,
        CancellationToken cancellationToken)
    {
        var fee = await pricing.ResolveDefaultFeeAsync(
            taskKind, partyType ?? "", areaM2, assigneeId, cancellationToken);
        return Ok(ResolvedPartyFeeDto.From(fee));
    }

    [HttpPost("po-enfaz-invoices/billed")]
    public async Task<ActionResult<IReadOnlyList<string>>> BilledPos(
        [FromBody] StringListRequest request,
        CancellationToken cancellationToken) =>
        Ok(await enfazInvoices.ListBilledPoNumbersAsync(request.Values, cancellationToken));
}
