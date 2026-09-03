using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Web;
using RealEstateEval.Platform.Application.Contracts;
using RealEstateEval.Platform.Application.Abstractions;

namespace RealEstateEval.Platform.Api.Controllers;

[ApiController]
[Route("api/regions")]
[Authorize]
public class RegionsController : ControllerBase
{
    private readonly IRegionsService _regions;

    public RegionsController(IRegionsService regions) => _regions = regions;

    [HttpGet("selectable")]
    public async Task<ActionResult<IReadOnlyList<SelectableRegionDto>>> Selectable(
        CancellationToken cancellationToken)
        => Ok(await _regions.ListSelectableRegionsAsync(cancellationToken));

 /// <summary>All active cities — pick city first, then fill region.</summary>
    [HttpGet("cities/selectable")]
    public async Task<ActionResult<IReadOnlyList<SelectableCityDto>>> AllSelectableCities(
        CancellationToken cancellationToken)
        => Ok(await _regions.ListAllSelectableCitiesAsync(cancellationToken));

    [HttpGet("{id:guid}/cities/selectable")]
    public async Task<ActionResult<IReadOnlyList<SelectableCityDto>>> SelectableCities(
        Guid id,
        [FromQuery] string? q,
        CancellationToken cancellationToken)
        => Ok(await _regions.SearchCitiesAsync(id, q, cancellationToken));

    [HttpGet("cities/{cityId:guid}/districts")]
    public async Task<ActionResult<IReadOnlyList<SelectableDistrictDto>>> SearchDistricts(
        Guid cityId,
        [FromQuery] string? q,
        CancellationToken cancellationToken)
        => Ok(await _regions.SearchDistrictsAsync(cityId, q, cancellationToken));

    [HttpPost("suggest")]
    public async Task<ActionResult<SuggestLocationResultDto>> Suggest(
        [FromBody] SuggestLocationRequest request,
        CancellationToken cancellationToken)
    {
        var userId = ActorIdOrUnauthorized();
        if (userId is null) return Unauthorized();
        try
        {
            return Ok(await _regions.SuggestAsync(request, userId, cancellationToken));
        }
        catch (InvalidOperationException ex)
        {
            return this.BadRequestProblem(ex.Message);
        }
    }

    [HttpGet("pending")]
    [Authorize(Policy = "CanManageUsers")]
    public async Task<ActionResult<IReadOnlyList<PendingLocationDto>>> Pending(
        CancellationToken cancellationToken)
        => Ok(await _regions.ListPendingAsync(cancellationToken));

    [HttpPost("cities/{id:guid}/review")]
    [Authorize(Policy = "CanManageUsers")]
    public async Task<IActionResult> ReviewCity(
        Guid id,
        [FromBody] ReviewLocationRequest request,
        CancellationToken cancellationToken)
    {
        var userId = ActorIdOrUnauthorized();
        if (userId is null) return Unauthorized();
        try
        {
            await _regions.ReviewCityAsync(id, request, userId, cancellationToken);
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return this.BadRequestProblem(ex.Message);
        }
    }

    [HttpPost("districts/{id:guid}/review")]
    [Authorize(Policy = "CanManageUsers")]
    public async Task<IActionResult> ReviewDistrict(
        Guid id,
        [FromBody] ReviewLocationRequest request,
        CancellationToken cancellationToken)
    {
        var userId = ActorIdOrUnauthorized();
        if (userId is null) return Unauthorized();
        try
        {
            await _regions.ReviewDistrictAsync(id, request, userId, cancellationToken);
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return this.BadRequestProblem(ex.Message);
        }
    }

    private string? ActorIdOrUnauthorized()
    {
        var id = ActorClaims.Id(User);
        return id is "unknown" or "" ? null : id;
    }
}
