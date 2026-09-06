using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Web;
using RealEstateEval.Shared.Web.Authorization;
using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Application.Abstractions;

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
    private readonly DatabaseOptions _dbOptions;

    public ComparablePropertiesController(
        IComparablePropertyService bank,
        IOptions<DatabaseOptions>? dbOptions = null)
    {
        _bank = bank;
        _dbOptions = dbOptions?.Value ?? new DatabaseOptions();
    }

 /// <summary>
 /// Comparable bank list. Sending page or pageSize returns PagedResultDto; without them the
 /// response stays the plain array every existing caller expects (the legacy <c>take</c> still
 /// caps it). See docs/architecture/pagination-contract.md §4.
 /// </summary>
        [HttpGet]
        [Authorize(Policy = CapabilityPolicyNames.ReadComparableBank)]
        public async Task<IActionResult> List(
        [FromQuery] ComparablePropertyListQuery query,
        CancellationToken ct)
    {
        if (!query.IsPaged)
            return Ok(await _bank.ListAsync(query, ct));

        var (skip, take, page, _) = NpgsqlConfiguration.ResolveListPaging(
            query.Page,
            query.PageSize,
            _dbOptions);
        return Ok(await _bank.ListPagedAsync(query, skip, take, page, ct));
    }

 /// <summary>System proximity stream — nearest active bank comps to subject coords.</summary>
        [HttpGet("proximity-suggestions")]
        [Authorize(Policy = CapabilityPolicyNames.ReadComparableBank)]
        public async Task<ActionResult<ComparableProximitySuggestionListDto>> ProximitySuggestions(
        [FromQuery] ComparableProximityQuery query,
        CancellationToken ct)
        => Ok(await _bank.SuggestByProximityAsync(query, ct));

        [HttpGet("{id:guid}")]
        [Authorize(Policy = CapabilityPolicyNames.ReadComparableBank)]
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

 /// <summary>Q-3 — human quality tags (reliability/duplicate) with rationale; record stays tagged, not deleted.</summary>
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

    [HttpPost("{id:guid}/reactivate")]
    [Authorize(Policy = CapabilityPolicyNames.WriteComparableBank)]
    public async Task<IActionResult> Reactivate(Guid id, CancellationToken ct)
    {
        var (ok, error) = await _bank.ReactivateAsync(id, ct);
        if (!ok) return this.BadRequestProblem(error ?? "تعذر تنفيذ العملية.");
        return NoContent();
    }
}
