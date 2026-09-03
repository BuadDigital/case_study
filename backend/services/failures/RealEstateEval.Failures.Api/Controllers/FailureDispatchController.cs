using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Shared.Web;
using RealEstateEval.Failures.Application.Abstractions;
using RealEstateEval.Failures.Application.Contracts;

namespace RealEstateEval.Failures.Api.Controllers;

/// <summary>
/// Authenticated lookup/commands used by Case Study and Operations. Operator queue routes
/// on <see cref="FailuresController"/> keep RaiseFailures / ManageFailures.
/// </summary>

[ApiController]
[Route("api/failure-dispatch")]
[Authorize]
[RequireUpstreamDispatch]
public sealed class FailureDispatchController(
    IFailureService failures,
    IFailureLookup lookup) : ControllerBase
{
    [HttpGet("gates")]
    public async Task<ActionResult<FailurePropertyGatesDto>> Gates(
        [FromQuery] string poNumber,
        [FromQuery] string propertyId,
        CancellationToken cancellationToken)
    {
        return Ok(new FailurePropertyGatesDto
        {
            HasActive = await lookup.HasActiveAsync(poNumber, propertyId, cancellationToken),
            HasBlocking = await lookup.HasBlockingAsync(poNumber, propertyId, cancellationToken),
        });
    }

    [HttpGet("approved-keys")]
    public async Task<ActionResult<IReadOnlyList<string>>> ApprovedKeys(
        CancellationToken cancellationToken) =>
        Ok(await lookup.ListApprovedPropertyKeysAsync(cancellationToken));

    [HttpGet("property")]
    public async Task<ActionResult<IReadOnlyList<FailureRecordDto>>> ListForProperty(
        [FromQuery] string poNumber,
        [FromQuery] string propertyId,
        CancellationToken cancellationToken) =>
        Ok(await lookup.ListForPropertyAsync(poNumber, propertyId, cancellationToken));

    [HttpGet("suspended")]
    public async Task<ActionResult<IReadOnlyList<FailureRecordDto>>> ListSuspended(
        CancellationToken cancellationToken) =>
        Ok(await lookup.ListSuspendedAsync(cancellationToken));

    [HttpGet("active-ids")]
    public async Task<ActionResult<IReadOnlyList<Guid>>> ListActiveIds(
        [FromQuery] string poNumber,
        [FromQuery] string propertyId,
        [FromQuery] string problemTypeId,
        [FromQuery] string raisedByRole,
        CancellationToken cancellationToken) =>
        Ok(await lookup.ListActiveIdsByProblemAsync(
            poNumber,
            propertyId,
            problemTypeId,
            raisedByRole,
            cancellationToken));

    [HttpPost("ensure-system-internal")]
    public async Task<ActionResult<FailureRecordDto>> EnsureSystemInternal(
        [FromBody] EnsureSystemInternalFailureRequest request,
        CancellationToken cancellationToken)
    {
        var dto = await failures.EnsureSystemInternalFailureAsync(
            request.PoNumber,
            request.PropertyId,
            request.DeedNumber,
            request.ProblemTypeId,
            request.Title,
            request.Note,
            request.Specialist,
            cancellationToken);
        return dto is null ? this.BadRequestProblem("لا يمكن إنشاء التعذر الداخلي") : Ok(dto);
    }

    [HttpPost("{id:guid}/resolve")]
    public async Task<ActionResult<FailureRecordDto>> Resolve(
        Guid id,
        [FromBody] ResolveFailureRequest request,
        CancellationToken cancellationToken)
    {
        var dto = await failures.ResolveAsync(id, request, cancellationToken);
        return dto is null ? this.BadRequestProblem("لا يمكن حل هذا التعذر") : Ok(dto);
    }

    [HttpPost("eviction-hold")]
    public async Task<IActionResult> ApplyEvictionHold(
        [FromBody] PropertyFailureHoldRequest request,
        CancellationToken cancellationToken)
    {
        await failures.ApplyEvictionHoldAsync(
            request.PoNumber,
            request.PropertyId,
            request.DeedNumber,
            request.Specialist,
            cancellationToken);
        return NoContent();
    }

    [HttpPost("eviction-hold/resolve")]
    public async Task<IActionResult> ResolveEvictionHold(
        [FromBody] ResolveEvictionHoldRequest request,
        CancellationToken cancellationToken)
    {
        await failures.ResolveEvictionHoldsAsync(
            request.PoNumber,
            request.PropertyId,
            request.Actor,
            cancellationToken);
        return NoContent();
    }

    [HttpPost("key-unmatched")]
    public async Task<IActionResult> EnsureKeyUnmatched(
        [FromBody] PropertyFailureHoldRequest request,
        CancellationToken cancellationToken)
    {
        await failures.EnsureKeyUnmatchedFailureAsync(
            request.PoNumber,
            request.PropertyId,
            request.DeedNumber,
            request.Specialist,
            cancellationToken);
        return NoContent();
    }
}
