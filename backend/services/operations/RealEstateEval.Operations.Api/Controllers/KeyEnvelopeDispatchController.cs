using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Operations.Application.Abstractions;
using RealEstateEval.Operations.Application.Contracts;
using RealEstateEval.Shared.Web;

namespace RealEstateEval.Operations.Api.Controllers;

/// <summary>
/// Authenticated lookup used by Case Study (billing entitlements, key gates).
/// Operator queue routes keep ReadKeyData / SubmitPartyWork.
/// </summary>
[ApiController]
[Route("api/key-envelope-dispatch")]
[Authorize]
[RequireUpstreamDispatch]
public sealed class KeyEnvelopeDispatchController(
    IKeyEntitlementLookup entitlements,
    IPropertyKeyGateResolver gates) : ControllerBase
{
    [HttpGet("entitlements")]
    public async Task<ActionResult<IReadOnlyList<KeyEnvelopeEntitlementDto>>> Entitlements(
        [FromQuery] string? propertyIds,
        CancellationToken cancellationToken)
    {
        var ids = ParseIds(propertyIds);
        return Ok(await entitlements.ListByPropertyIdsAsync(ids, cancellationToken));
    }

    [HttpGet("gate")]
    public async Task<ActionResult<PropertyKeyGateDto>> Gate(
        [FromQuery] Guid? propertyId,
        [FromQuery] string? poNumber,
        [FromQuery] string? deedNumber,
        [FromQuery] string? requestNumber,
        CancellationToken cancellationToken) =>
        Ok(await gates.ResolveAsync(propertyId, poNumber, deedNumber, requestNumber, cancellationToken));

    private static IReadOnlyList<Guid> ParseIds(string? propertyIds)
    {
        if (string.IsNullOrWhiteSpace(propertyIds))
            return [];

        var ids = new List<Guid>();
        foreach (var part in propertyIds.Split(
            ',',
            StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            if (Guid.TryParse(part, out var id))
                ids.Add(id);
        }

        return ids;
    }
}
