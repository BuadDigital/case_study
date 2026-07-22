using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Web.Authorization;

namespace RealEstateEval.Financial.Api.Controllers;

[ApiController]
[Route("api/financial/v1")]
[Authorize]
public class FinancialController : ControllerBase
{
    private readonly IFinancialReportService _financial;
    private readonly IPartyFeePricingService _pricing;

    public FinancialController(
        IFinancialReportService financial,
        IPartyFeePricingService pricing)
    {
        _financial = financial;
        _pricing = pricing;
    }

    [HttpGet("summary")]
    public async Task<ActionResult<FinancialSummaryDto>> Summary(CancellationToken ct)
        => Ok(await _financial.GetSummaryAsync(ct));

    [HttpPut("summary")]
    [Authorize(Policy = CapabilityPolicyNames.ManageFinancial)]
    public async Task<ActionResult<FinancialSummaryDto>> Save(
        [FromBody] FinancialSummaryDto request,
        CancellationToken ct)
        => Ok(await _financial.SaveSummaryAsync(request, ct));

    [HttpGet("party-fee-pricing")]
    public async Task<ActionResult<PartyFeePricingDto>> GetActivePartyFeePricing(CancellationToken ct)
        => Ok(await _pricing.GetActiveAsync(ct));

    [HttpGet("party-fee-pricing/tables")]
    public async Task<ActionResult<IReadOnlyList<PartyFeePricingTableSummaryDto>>> ListPartyFeePricingTables(
        [FromQuery] string? category,
        CancellationToken ct)
        => Ok(await _pricing.ListAsync(category, ct));

    [HttpGet("party-fee-pricing/{id:guid}")]
    public async Task<ActionResult<PartyFeePricingDto>> GetPartyFeePricing(Guid id, CancellationToken ct)
    {
        var row = await _pricing.GetByIdAsync(id, ct);
        return row is null ? NotFound() : Ok(row);
    }

    [HttpPost("party-fee-pricing")]
    [Authorize(Policy = CapabilityPolicyNames.ManageSystemConfig)]
    public async Task<ActionResult<PartyFeePricingDto>> CreatePartyFeePricing(
        [FromBody] CreatePartyFeePricingTableRequest request,
        CancellationToken ct)
        => Ok(await _pricing.CreateAsync(request, ct));

    [HttpPut("party-fee-pricing/{id:guid}")]
    [Authorize(Policy = CapabilityPolicyNames.ManageSystemConfig)]
    public async Task<ActionResult<PartyFeePricingDto>> SavePartyFeePricing(
        Guid id,
        [FromBody] PartyFeePricingDto request,
        CancellationToken ct)
    {
        try
        {
            return Ok(await _pricing.SaveAsync(id, request, ct));
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    [HttpPost("party-fee-pricing/{id:guid}/activate")]
    [Authorize(Policy = CapabilityPolicyNames.ManageSystemConfig)]
    public async Task<ActionResult<PartyFeePricingDto>> ActivatePartyFeePricing(
        Guid id,
        CancellationToken ct)
    {
        try
        {
            return Ok(await _pricing.ActivateAsync(id, ct));
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    [HttpGet("party-fee-pricing/{id:guid}/assignments")]
    [Authorize(Policy = CapabilityPolicyNames.ManageSystemConfig)]
    public async Task<ActionResult<IReadOnlyList<string>>> ListPartyFeePricingAssignments(
        Guid id,
        CancellationToken ct)
        => Ok(await _pricing.ListAssignmentsAsync(id, ct));

    [HttpPut("party-fee-pricing/{id:guid}/assignments")]
    [Authorize(Policy = CapabilityPolicyNames.ManageSystemConfig)]
    public async Task<ActionResult<PartyFeePricingDto>> SetPartyFeePricingAssignments(
        Guid id,
        [FromBody] SetPartyFeePricingAssignmentsRequest request,
        CancellationToken ct)
    {
        try
        {
            return Ok(await _pricing.SetAssignmentsAsync(id, request.AssigneeIds ?? [], ct));
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    [HttpDelete("party-fee-pricing/{id:guid}")]
    [Authorize(Policy = CapabilityPolicyNames.ManageSystemConfig)]
    public async Task<IActionResult> DeletePartyFeePricing(Guid id, CancellationToken ct)
    {
        try
        {
            var deleted = await _pricing.DeleteAsync(id, ct);
            return deleted ? NoContent() : NotFound();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }
}
