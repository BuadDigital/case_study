using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Web;
using RealEstateEval.Shared.Web.Authorization;

namespace RealEstateEval.Valuation.Api.Controllers;

/// <summary>
/// Company-wide comparable bank scaffold — CRUD + filter + source card.
/// Selection into a valuation request: see ValuationComparableSelectionsController.
/// </summary>
[ApiController]
[Route("api/comparable-properties")]
[Authorize]
public class ComparablePropertiesController : ControllerBase
{
    private readonly IComparablePropertyService _bank;

    public ComparablePropertiesController(IComparablePropertyService bank) => _bank = bank;

    [HttpGet]
    [Authorize(Policy = CapabilityPolicyNames.ReadValuationQueue)]
    public async Task<ActionResult<IReadOnlyList<ComparablePropertyDto>>> List(
        [FromQuery] ComparablePropertyListQuery query,
        CancellationToken ct)
        => Ok(await _bank.ListAsync(query, ct));

 /// <summary>System proximity stream — nearest active bank comps to subject coords.</summary>
    [HttpGet("proximity-suggestions")]
    [Authorize(Policy = CapabilityPolicyNames.ReadValuationQueue)]
    public async Task<ActionResult<ComparableProximitySuggestionListDto>> ProximitySuggestions(
        [FromQuery] ComparableProximityQuery query,
        CancellationToken ct)
        => Ok(await _bank.SuggestByProximityAsync(query, ct));

    [HttpGet("{id:guid}")]
    [Authorize(Policy = CapabilityPolicyNames.ReadValuationQueue)]
    public async Task<ActionResult<ComparablePropertyDto>> Get(Guid id, CancellationToken ct)
    {
        var row = await _bank.GetAsync(id, ct);
        return row is null ? NotFound() : Ok(row);
    }

    [HttpPost]
    [Authorize(Policy = CapabilityPolicyNames.WriteComparableBank)]
    public async Task<ActionResult<ComparablePropertyDto>> Create(
        [FromBody] UpsertComparablePropertyRequest request,
        CancellationToken ct)
    {
        var (result, errors) = await _bank.CreateAsync(request, ActorClaims.Id(User), ct);
        if (errors is not null)
            return this.FieldErrorsProblem(errors);
        return CreatedAtAction(nameof(Get), new { id = result!.Id }, result);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = CapabilityPolicyNames.WriteComparableBank)]
    public async Task<ActionResult<ComparablePropertyDto>> Update(
        Guid id,
        [FromBody] UpsertComparablePropertyRequest request,
        CancellationToken ct)
    {
        var (result, errors) = await _bank.UpdateAsync(id, request, ct);
        if (errors is not null)
            return this.FieldErrorsProblem(errors);
        return Ok(result);
    }

 /// <summary>ق-3 — وسوم الجودة البشرية (موثوقية/مكرر) بمبرر؛ السجل يبقى موسوماً لا يُحذف.</summary>
    [HttpPut("{id:guid}/quality-tags")]
    [Authorize(Policy = CapabilityPolicyNames.WriteComparableBank)]
    public async Task<ActionResult<ComparablePropertyDto>> SetQualityTags(
        Guid id,
        [FromBody] SaveComparableQualityTagsRequest request,
        CancellationToken ct)
    {
        var (result, errors) = await _bank.SetQualityTagsAsync(id, request, ActorClaims.Id(User), ct);
        if (errors is not null)
            return this.FieldErrorsProblem(errors);
        return Ok(result);
    }

    [HttpPost("{id:guid}/deactivate")]
    [Authorize(Policy = CapabilityPolicyNames.WriteComparableBank)]
    public async Task<IActionResult> Deactivate(Guid id, CancellationToken ct)
    {
        var (ok, error) = await _bank.DeactivateAsync(id, ct);
        if (!ok) return this.BadRequestProblem(error ?? "تعذر تنفيذ العملية.");
        return NoContent();
    }
}
