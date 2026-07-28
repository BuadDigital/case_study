using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;

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

    /// <summary>كل المدن النشطة — لاختيار المدينة أولاً ثم تعبئة المنطقة.</summary>
    [HttpGet("cities/selectable")]
    public async Task<ActionResult<IReadOnlyList<SelectableCityDto>>> AllSelectableCities(
        CancellationToken cancellationToken)
        => Ok(await _regions.ListAllSelectableCitiesAsync(cancellationToken));

    [HttpGet("{id:guid}/cities/selectable")]
    public async Task<ActionResult<IReadOnlyList<SelectableCityDto>>> SelectableCities(
        Guid id,
        CancellationToken cancellationToken)
        => Ok(await _regions.ListSelectableCitiesAsync(id, cancellationToken));
}
