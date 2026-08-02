using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Web;
using RealEstateEval.Shared.Web.Authorization;

namespace RealEstateEval.Financial.Api.Controllers;

[ApiController]
[Route("api/financial")]
[Route("api/financial/v1")]
[Authorize]
public class FinancialController : ControllerBase
{
    private readonly IFinancialReportService _financial;
    private readonly IPartyFeePricingService _pricing;
    private readonly ILogger<FinancialController> _logger;

    public FinancialController(
        IFinancialReportService financial,
        IPartyFeePricingService pricing,
        ILogger<FinancialController> logger)
    {
        _financial = financial;
        _pricing = pricing;
        _logger = logger;
    }

    [HttpGet("summary")]
    [Authorize(Policy = CapabilityPolicyNames.ManageFinancial)]
    public async Task<ActionResult<FinancialSummaryDto>> Summary(CancellationToken ct)
        => Ok(await _financial.GetSummaryAsync(ct));

    [HttpPut("summary")]
    [Authorize(Policy = CapabilityPolicyNames.ManageFinancial)]
    public async Task<ActionResult<FinancialSummaryDto>> Save(
        [FromBody] FinancialSummaryDto request,
        CancellationToken ct)
        => Ok(await _financial.SaveSummaryAsync(request, ct));

    [HttpGet("party-fee-pricing/tables")]
    public async Task<ActionResult<IReadOnlyList<PartyFeePricingTableSummaryDto>>> ListPartyFeePricingTables(
        [FromQuery] string? category,
        CancellationToken ct)
    {
        // An unknown filter used to be coerced to engineering-survey, so a typo silently returned
        // another category's tables as if they were the ones asked for.
        if (!string.IsNullOrWhiteSpace(category) && !PartyFeePricingCategories.IsValid(category))
            return this.BadRequestProblem(PartyFeePricingCategories.InvalidMessage(category));

        return Ok(await _pricing.ListAsync(category, ct));
    }

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
    {
        if (!PartyFeePricingCategories.IsValid(request.Category))
            return this.BadRequestProblem(PartyFeePricingCategories.InvalidMessage(request.Category));

        try
        {
            return Ok(await _pricing.CreateAsync(request, ct, ActorClaims.Id(User)));
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Rejected create of party fee pricing table");
            return this.BadRequestProblem(ex.Message);
        }
    }

    [HttpPut("party-fee-pricing/{id:guid}")]
    [Authorize(Policy = CapabilityPolicyNames.ManageSystemConfig)]
    public async Task<ActionResult<PartyFeePricingDto>> SavePartyFeePricing(
        Guid id,
        [FromBody] PartyFeePricingDto request,
        CancellationToken ct)
    {
        try
        {
            return Ok(await _pricing.SaveAsync(id, request, ct, ActorClaims.Id(User)));
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Rejected save of party fee pricing table {TableId}", id);
            return this.BadRequestProblem(ex.Message);
        }
    }

    [HttpPost("party-fee-pricing/{id:guid}/revision")]
    [Authorize(Policy = CapabilityPolicyNames.ManageSystemConfig)]
    public async Task<ActionResult<PartyFeePricingDto>> RevisePartyFeePricing(
        Guid id,
        [FromBody] PartyFeePricingDto request,
        CancellationToken ct)
    {
        try
        {
            return Ok(await _pricing.ReviseAsync(id, request, ct, ActorClaims.Id(User)));
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Rejected revision of party fee pricing table {TableId}", id);
            return this.BadRequestProblem(ex.Message);
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
            return Ok(await _pricing.ActivateAsync(id, ct, ActorClaims.Id(User)));
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    [HttpPut("party-fee-pricing/{id:guid}/assignments")]
    [Authorize(Policy = CapabilityPolicyNames.ManageSystemConfig)]
    public async Task<ActionResult<PartyFeePricingDto>> SetPartyFeePricingAssignments(
        Guid id,
        [FromBody] SetPartyFeePricingAssignmentsRequest request,
        CancellationToken ct)
    {
        try
        {
            return Ok(await _pricing.SetAssignmentsAsync(
                id,
                request.AssigneeIds ?? [],
                ct,
                ActorClaims.Id(User)));
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
            var deleted = await _pricing.DeleteAsync(id, ct, ActorClaims.Id(User));
            return deleted ? NoContent() : NotFound();
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Rejected delete of party fee pricing table {TableId}", id);
            return this.BadRequestProblem(
                "تعذر حذف جدول الأتعاب — يجب ألا يكون مرتبطاً بأطراف، ويجب أن يبقى جدول واحد على الأقل في التصنيف.");
        }
    }
}
