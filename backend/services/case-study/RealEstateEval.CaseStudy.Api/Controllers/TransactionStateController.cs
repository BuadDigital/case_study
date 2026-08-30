using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.Shared.Web;
using RealEstateEval.Shared.Web.Authorization;

namespace RealEstateEval.CaseStudy.Api.Controllers;

/// <summary>
/// Q-9: transaction state derived from party states (distribution network and dependencies — the Inspector is the key
/// key) + second conclusion: Upload the Transaction on Enfaz.
/// </summary>
[ApiController]
[Route("api/work-orders/{workOrderId:guid}/properties/{propertyId:guid}/transaction-state")]
[Authorize]
public class TransactionStateController : ControllerBase
{
    private readonly ITransactionStateService _state;

    public TransactionStateController(ITransactionStateService state) => _state = state;

    [HttpGet]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<ActionResult<TransactionStateDto>> Get(
        Guid workOrderId,
        Guid propertyId,
        CancellationToken ct)
    {
        var state = await _state.GetStateAsync(workOrderId, propertyId, ct);
        return state is null ? NotFound() : Ok(state);
    }

    [HttpPost("enfaz-handover")]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<ActionResult<TransactionStateDto>> RecordHandover(
        Guid workOrderId,
        Guid propertyId,
        CancellationToken ct)
    {
        var (result, error) = await _state.RecordEnfazHandoverAsync(
            workOrderId,
            propertyId,
            ActorClaims.Id(User),
            ct);
        if (error is not null)
            return this.FieldErrorsProblem(new Dictionary<string, string> { ["_"] = error });
        return Ok(result);
    }

    /// <summary>
    /// Supplemental Q-9 (R3): After uploading Enfaz — Audit Entry with Decision General Manager and its reason only;
    /// It does not open anything (the actual recovery is through reopening the R2 rating).
    /// </summary>
    [HttpPost("post-enfaz-decision")]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<IActionResult> RecordPostEnfazDecision(
        Guid workOrderId,
        Guid propertyId,
        [FromBody] PostEnfazDecisionRequest request,
        CancellationToken ct)
    {
        var error = await _state.RecordPostEnfazDecisionAsync(
            workOrderId,
            propertyId,
            request,
            ActorClaims.Id(User),
            ActorClaims.Role(User),
            ct);
        if (error is not null)
            return this.FieldErrorsProblem(new Dictionary<string, string> { ["_"] = error });
        return NoContent();
    }
}
