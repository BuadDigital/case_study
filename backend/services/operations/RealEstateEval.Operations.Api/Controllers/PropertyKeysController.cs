using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Web.Authorization;
using RealEstateEval.Operations.Application.Contracts;
using RealEstateEval.Operations.Application.Abstractions;

namespace RealEstateEval.Operations.Api.Controllers;

[ApiController]
[Route("api/property-keys")]
[Authorize(Policy = CapabilityPolicyNames.ReadKeyData)]
public class PropertyKeysController : ControllerBase
{
    private readonly IPropertyKeysService _keys;

    public PropertyKeysController(IPropertyKeysService keys) => _keys = keys;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<PropertyKeyRecordDto>>> List(
        [FromQuery] bool? hasKey,
        CancellationToken ct)
        => Ok(await _keys.ListAsync(hasKey, ct));

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<PropertyKeyRecordDto>> Get(Guid id, CancellationToken ct)
    {
        var dto = await _keys.GetAsync(id, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPatch("{id:guid}")]
    [Authorize(Policy = CapabilityPolicyNames.ManageOperations)]
    public async Task<ActionResult<PropertyKeyRecordDto>> Patch(
        Guid id,
        [FromBody] UpdatePropertyKeyRequest request,
        CancellationToken ct)
    {
        var dto = await _keys.PatchAsync(id, request, ct);
        return dto is null ? NotFound() : Ok(dto);
    }
}
