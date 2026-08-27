using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Web;
using RealEstateEval.Shared.Web.Authorization;
using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Application.Abstractions;

namespace RealEstateEval.Valuation.Api.Controllers;

/// <summary>
/// Select / adopt bank comps + sequential market adjustments / weights.
/// </summary>
[ApiController]
[Route("api/valuation-requests/{valuationRequestId:guid}/comparable-selections")]
[Authorize]
public class ValuationComparableSelectionsController : ControllerBase
{
    private readonly IValuationComparableSelectionService _selections;

    public ValuationComparableSelectionsController(IValuationComparableSelectionService selections) => _selections = selections;

    [HttpGet]
    [Authorize(Policy = CapabilityPolicyNames.ReadValuationQueue)]
    public async Task<ActionResult<ValuationComparableSelectionListDto>> List(
        Guid valuationRequestId,
        [FromQuery] string? selectionContext,
        CancellationToken ct)
    {
        var dto = await _selections.ListAsync(
            valuationRequestId,
            selectionContext ?? "market",
            ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPut]
    [Authorize(Policy = CapabilityPolicyNames.SubmitValuationReport)]
    public async Task<ActionResult<ValuationComparableSelectionListDto>> Replace(
        Guid valuationRequestId,
        [FromBody] ReplaceValuationComparableSelectionsRequest request,
        CancellationToken ct)
    {
        var (result, errors) = await _selections.ReplaceAsync(
            valuationRequestId,
            request,
            ActorClaims.Id(User),
            ct);
        if (errors is not null)
            return this.FieldErrorsProblem(errors);
        return Ok(result);
    }

    [HttpPut("{selectionId:guid}/market")]
    [Authorize(Policy = CapabilityPolicyNames.SubmitValuationReport)]
    public async Task<ActionResult<ValuationComparableSelectionDto>> SaveMarket(
        Guid valuationRequestId,
        Guid selectionId,
        [FromBody] SaveValuationComparableMarketRequest request,
        CancellationToken ct)
    {
        var (result, errors) = await _selections.SaveMarketAsync(
            valuationRequestId,
            selectionId,
            request,
            ct);
        if (errors is not null)
            return this.FieldErrorsProblem(errors);
        return Ok(result);
    }

    [HttpPut("~/api/valuation-requests/{valuationRequestId:guid}/market-approach")]
    [Authorize(Policy = CapabilityPolicyNames.SubmitValuationReport)]
    public async Task<ActionResult<ValuationComparableSelectionListDto>> SaveMarketApproach(
        Guid valuationRequestId,
        [FromBody] SaveValuationMarketApproachRequest request,
        CancellationToken ct)
    {
        var (result, errors) = await _selections.SaveMarketApproachAsync(
            valuationRequestId,
            request,
            ct);
        if (errors is not null)
            return this.FieldErrorsProblem(errors);
        return Ok(result);
    }

    [HttpPost("{comparablePropertyId:guid}/adopt")]
    [Authorize(Policy = CapabilityPolicyNames.SubmitValuationReport)]
    public async Task<ActionResult<ValuationComparableSelectionDto>> SetAdopted(
        Guid valuationRequestId,
        Guid comparablePropertyId,
        [FromBody] AdoptComparableRequest body,
        [FromQuery] string? selectionContext,
        CancellationToken ct)
    {
        var (result, error) = await _selections.SetAdoptedAsync(
            valuationRequestId,
            comparablePropertyId,
            body.IsAdopted,
            ActorClaims.Id(User),
            ct,
            selectionContext: selectionContext ?? body.SelectionContext);
        if (error is not null)
            return this.BadRequestProblem(error);
        return Ok(result);
    }

    [HttpDelete("{comparablePropertyId:guid}")]
    [Authorize(Policy = CapabilityPolicyNames.SubmitValuationReport)]
    public async Task<IActionResult> Remove(
        Guid valuationRequestId,
        Guid comparablePropertyId,
        [FromQuery] string? selectionContext,
        CancellationToken ct)
    {
        var (ok, error) = await _selections.RemoveAsync(
            valuationRequestId,
            comparablePropertyId,
            ct,
            selectionContext: selectionContext);
        if (!ok) return this.BadRequestProblem(error ?? "تعذر تنفيذ العملية.");
        return NoContent();
    }
}

public sealed class AdoptComparableRequest
{
    public bool IsAdopted { get; init; } = true;
    /// <summary>market | land_within_cost</summary>
    public string? SelectionContext { get; init; }
}
