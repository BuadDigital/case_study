using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Shared.Web.Authorization;
using RealEstateEval.Operations.Application.Contracts;
using RealEstateEval.Operations.Application.Abstractions;

namespace RealEstateEval.Operations.Api.Controllers;

/// <summary>
/// <c>/api/key-envelopes/gate</c> on its own policy: the field parties' dashboards check a
/// property's key before a visit, without the key-custody rights the rest of
/// <see cref="KeyEnvelopesController"/> needs.
/// </summary>
[ApiController]
[Route("api/key-envelopes")]
[Authorize(Policy = CapabilityPolicyNames.ReadKeyGate)]
public class KeyEnvelopeGateController : ControllerBase
{
    private readonly IPropertyKeyGateResolver _gates;

    public KeyEnvelopeGateController(IPropertyKeyGateResolver gates) => _gates = gates;

    [HttpGet("gate")]
    public async Task<ActionResult<PropertyKeyGateDto>> Gate(
        [FromQuery] Guid? propertyId,
        [FromQuery] string? poNumber,
        [FromQuery] string? deedNumber,
        [FromQuery] string? requestNumber,
        CancellationToken ct)
        => Ok(await _gates.ResolveAsync(propertyId, poNumber, deedNumber, requestNumber, ct));
}
