using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Web.Authorization;

namespace RealEstateEval.Platform.Api.Controllers;

[ApiController]
[Route("api/courts")]
[Authorize]
public class CourtsController : ControllerBase
{
    private readonly ICourtsCatalogService _catalog;
    private readonly ICourtsService _courts;

    public CourtsController(ICourtsCatalogService catalog, ICourtsService courts)
    {
        _catalog = catalog;
        _courts = courts;
    }

    /// <summary>Legacy catalog list (city + court + circuits[]) for existing admin UI.</summary>
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<CourtCatalogEntryDto>>> List(
        CancellationToken cancellationToken)
        => Ok(await _catalog.ListAsync(cancellationToken));

    [HttpPut]
    [Authorize(Policy = CapabilityPolicyNames.ManageCourts)]
    public async Task<ActionResult<IReadOnlyList<CourtCatalogEntryDto>>> ReplaceAll(
        [FromBody] SaveCourtsCatalogRequest request,
        CancellationToken cancellationToken)
        => Ok(await _catalog.ReplaceAllAsync(request, cancellationToken));

    [HttpGet("selectable")]
    public async Task<ActionResult<IReadOnlyList<SelectableCourtDto>>> Selectable(
        [FromQuery] string? region,
        [FromQuery] string? city,
        CancellationToken cancellationToken)
        => Ok(await _courts.ListSelectableAsync(region, city, cancellationToken));

    [HttpGet("{id:guid}/circuits/selectable")]
    public async Task<ActionResult<IReadOnlyList<SelectableCircuitDto>>> SelectableCircuits(
        Guid id,
        CancellationToken cancellationToken)
        => Ok(await _courts.ListSelectableCircuitsAsync(id, cancellationToken));
}

[ApiController]
[Route("api/admin/courts")]
[Authorize(Policy = CapabilityPolicyNames.ManageCourts)]
public class AdminCourtsController : ControllerBase
{
    private readonly ICourtsService _courts;

    public AdminCourtsController(ICourtsService courts) => _courts = courts;

    private static string ActorId(ClaimsPrincipal user) =>
        user.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? user.FindFirstValue("sub")
        ?? "unknown";

    [HttpGet]
    public async Task<ActionResult<CourtListResponseDto>> List(
        [FromQuery] string? search,
        [FromQuery] string? status,
        [FromQuery] string? region,
        [FromQuery] string? city,
        [FromQuery] int page = 1,
        [FromQuery] int limit = 50,
        CancellationToken cancellationToken = default)
        => Ok(await _courts.ListAdminAsync(search, status, region, city, page, limit, cancellationToken));

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<CourtDetailDto>> Get(Guid id, CancellationToken cancellationToken)
    {
        var row = await _courts.GetAdminAsync(id, cancellationToken);
        return row is null ? NotFound() : Ok(row);
    }

    [HttpPost]
    public async Task<ActionResult<CourtDto>> Create(
        [FromBody] CreateCourtRequest request,
        CancellationToken cancellationToken)
    {
        var (court, error) = await _courts.CreateAsync(request, ActorId(User), cancellationToken);
        if (error is not null) return BadRequest(new { message = error });
        return CreatedAtAction(nameof(Get), new { id = court!.Id }, court);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<CourtDto>> Update(
        Guid id,
        [FromBody] UpdateCourtRequest request,
        CancellationToken cancellationToken)
    {
        var (court, error) = await _courts.UpdateAsync(id, request, ActorId(User), cancellationToken);
        if (error is not null) return BadRequest(new { message = error });
        return Ok(court);
    }

    [HttpPatch("{id:guid}/status")]
    public async Task<ActionResult<object>> SetStatus(
        Guid id,
        [FromBody] SetActiveStatusRequest request,
        CancellationToken cancellationToken)
    {
        var (court, error) = await _courts.SetCourtStatusAsync(
            id,
            request.IsActive,
            ActorId(User),
            cancellationToken);
        if (error is not null) return BadRequest(new { message = error });
        return Ok(new { id = court!.Id, isActive = court.IsActive });
    }

    [HttpPost("{courtId:guid}/circuits")]
    public async Task<ActionResult<CourtCircuitDto>> CreateCircuit(
        Guid courtId,
        [FromBody] CreateCourtCircuitRequest request,
        CancellationToken cancellationToken)
    {
        var (circuit, error) = await _courts.CreateCircuitAsync(
            courtId,
            request,
            ActorId(User),
            cancellationToken);
        if (error is not null) return BadRequest(new { message = error });
        return StatusCode(StatusCodes.Status201Created, circuit);
    }

    [HttpPut("{courtId:guid}/circuits/{id:guid}")]
    public async Task<ActionResult<CourtCircuitDto>> UpdateCircuit(
        Guid courtId,
        Guid id,
        [FromBody] UpdateCourtCircuitRequest request,
        CancellationToken cancellationToken)
    {
        var (circuit, error) = await _courts.UpdateCircuitAsync(
            courtId,
            id,
            request,
            ActorId(User),
            cancellationToken);
        if (error is not null) return BadRequest(new { message = error });
        return Ok(circuit);
    }

    [HttpPatch("{courtId:guid}/circuits/{id:guid}/status")]
    public async Task<ActionResult<object>> SetCircuitStatus(
        Guid courtId,
        Guid id,
        [FromBody] SetActiveStatusRequest request,
        CancellationToken cancellationToken)
    {
        var (circuit, error) = await _courts.SetCircuitStatusAsync(
            courtId,
            id,
            request.IsActive,
            ActorId(User),
            cancellationToken);
        if (error is not null) return BadRequest(new { message = error });
        return Ok(new { id = circuit!.Id, isActive = circuit.IsActive });
    }
}
