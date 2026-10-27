// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 1 (5b554f4e)
//  • Access  GET uses ReadValuationReport (the case specialist can read it); PUT is limited to the assigned
//            appraiser.
//  • Alerts  New PUT alert-overrides: saves the alert dispositions only, leaving the rest of the
//            reconciliation as saved (SaveAlertOverridesAsync).
// ──────────────────────────────────────────────────────────────────────────────────────────────

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Web;
using RealEstateEval.Shared.Web.Authorization;
using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Application.Abstractions;

namespace RealEstateEval.Valuation.Api.Controllers;

/// <summary>Reconciliation + round-once final opinion.</summary>
[ApiController]
[Route("api/valuation-requests/{valuationRequestId:guid}/reconciliation")]
[Authorize]
public class ValuationReconciliationController : ControllerBase
{
    private readonly IValuationReconciliationService _reconciliation;

    public ValuationReconciliationController(IValuationReconciliationService reconciliation) =>
        _reconciliation = reconciliation;

    [HttpGet]
    [Authorize(Policy = CapabilityPolicyNames.ReadValuationReport)]
    public async Task<ActionResult<ValuationReconciliationDto>> Get(
        Guid valuationRequestId,
        CancellationToken ct)
    {
        var dto = await _reconciliation.GetAsync(valuationRequestId, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPut]
    [Authorize(Policy = CapabilityPolicyNames.SubmitValuationReport)]
    [RequireAssignedAppraiser]
    public async Task<ActionResult<ValuationReconciliationDto>> Save(
        Guid valuationRequestId,
        [FromBody] SaveValuationReconciliationRequest request,
        CancellationToken ct)
    {
        var (result, errors) = await _reconciliation.SaveAsync(
            valuationRequestId, request, ActorClaims.Id(User), ct);
        if (errors is not null)
            return this.FieldErrorsProblem(errors);
        return Ok(result);
    }

    /// <summary>Alert dispositions only — the rest of the reconciliation is left as saved.</summary>
    [HttpPut("alert-overrides")]
    [Authorize(Policy = CapabilityPolicyNames.SubmitValuationReport)]
    [RequireAssignedAppraiser]
    public async Task<ActionResult<ValuationReconciliationDto>> SaveAlertOverrides(
        Guid valuationRequestId,
        [FromBody] SaveValuationAlertOverridesRequest request,
        CancellationToken ct)
    {
        var (result, errors) = await _reconciliation.SaveAlertOverridesAsync(
            valuationRequestId, request, ActorClaims.Id(User), ct);
        if (errors is not null)
            return this.FieldErrorsProblem(errors);
        return Ok(result);
    }
}
