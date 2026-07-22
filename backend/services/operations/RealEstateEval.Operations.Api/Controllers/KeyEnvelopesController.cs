using System;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Web;
using RealEstateEval.Shared.Web.Authorization;

namespace RealEstateEval.Operations.Api.Controllers;

[ApiController]
[Route("api/key-envelopes")]
[Authorize]
public class KeyEnvelopesController : ControllerBase
{
    private readonly IKeyEnvelopesService _envelopes;
    private readonly IPropertyKeyGateResolver _gates;

    public KeyEnvelopesController(
        IKeyEnvelopesService envelopes,
        IPropertyKeyGateResolver gates)
    {
        _envelopes = envelopes;
        _gates = gates;
    }

    private string ActorId() => ActorClaims.Id(User);

    private string ActorName() => ActorClaims.DisplayName(User);

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<KeyEnvelopeDto>>> List(CancellationToken ct)
        => Ok(await _envelopes.ListAsync(ct));

    [HttpGet("fee-report")]
    public async Task<ActionResult<IReadOnlyList<KeyEnvelopeFeeReportRowDto>>> FeeReport(
        CancellationToken ct)
        => Ok(await _envelopes.ListFeeReportAsync(ct));

    [HttpPost("{id:guid}/fee-collected")]
    [Authorize(Policy = CapabilityPolicyNames.SubmitPartyWork)]
    public async Task<ActionResult<KeyEnvelopeFeeReportRowDto>> MarkFeeCollected(
        Guid id,
        [FromBody] MarkKeyReceiptFeeCollectedRequest? body,
        CancellationToken ct)
    {
        var (row, error) = await _envelopes.MarkFeeCollectedAsync(
            id,
            body?.InvoiceReference,
            ct);
        if (error is not null)
            return error.Contains("غير موجود") ? NotFound(new { message = error })
                : BadRequest(new { message = error });
        return Ok(row);
    }

    [HttpGet("gate")]
    public async Task<ActionResult<PropertyKeyGateDto>> Gate(
        [FromQuery] Guid? propertyId,
        [FromQuery] string? poNumber,
        [FromQuery] string? deedNumber,
        [FromQuery] string? requestNumber,
        CancellationToken ct)
        => Ok(await _gates.ResolveAsync(propertyId, poNumber, deedNumber, requestNumber, ct));

    [HttpGet("court-access")]
    public async Task<ActionResult<IReadOnlyList<PropertyCourtAccessDto>>> CourtAccess(
        [FromQuery] string? requestNumber,
        CancellationToken ct)
        => Ok(await _envelopes.ListCourtAccessAsync(requestNumber, ct));

    [HttpGet("linked-properties")]
    public async Task<ActionResult<IReadOnlyList<KeyEnvelopeLinkedPropertyDto>>> LinkedProperties(
        [FromQuery] string requestNumber,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(requestNumber))
            return BadRequest(new { message = "requestNumber مطلوب" });
        return Ok(await _envelopes.ListLinkedPropertiesAsync(requestNumber, ct));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<KeyEnvelopeDto>> Get(Guid id, CancellationToken ct)
    {
        var row = await _envelopes.GetAsync(id, ct);
        return row is null ? NotFound() : Ok(row);
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = CapabilityPolicyNames.SubmitPartyWork)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
        => await _envelopes.DeleteAsync(id, ct) ? NoContent() : NotFound();

    [HttpPost]
    [Authorize(Policy = CapabilityPolicyNames.SubmitPartyWork)]
    public async Task<ActionResult<KeyEnvelopeDto>> Create(
        [FromBody] CreateKeyEnvelopeRequest request,
        CancellationToken ct)
    {
        var (envelope, error) = await _envelopes.CreateAsync(
            request,
            ActorId(),
            ActorName(),
            ct);
        if (error is not null) return BadRequest(new { message = error });
        return CreatedAtAction(nameof(Get), new { id = envelope!.Id }, envelope);
    }

    [HttpPost("{id:guid}/assignments")]
    [Authorize(Policy = CapabilityPolicyNames.SubmitPartyWork)]
    public async Task<ActionResult<KeyEnvelopeDto>> AddAssignment(
        Guid id,
        [FromBody] AddKeyEnvelopeAssignmentRequest request,
        CancellationToken ct)
    {
        var (envelope, error) = await _envelopes.AddAssignmentAsync(
            id, request, ActorId(), ActorName(), ct);
        if (error is not null)
            return error.Contains("غير موجود") ? NotFound(new { message = error })
                : BadRequest(new { message = error });
        return Ok(envelope);
    }

    [HttpPost("{id:guid}/assignments/{assignmentId:guid}/confirm")]
    [Authorize(Policy = CapabilityPolicyNames.SubmitPartyWork)]
    public async Task<ActionResult<KeyEnvelopeDto>> ConfirmAssignment(
        Guid id,
        Guid assignmentId,
        [FromBody] ConfirmKeyAssignmentRequest request,
        CancellationToken ct)
    {
        var (envelope, error) = await _envelopes.ConfirmAssignmentAsync(
            id, assignmentId, request, ActorId(), ActorName(), ct);
        if (error is not null)
            return error.Contains("غير موجود") ? NotFound(new { message = error })
                : BadRequest(new { message = error });
        return Ok(envelope);
    }

    [HttpPost("{id:guid}/handoffs")]
    [Authorize(Policy = CapabilityPolicyNames.SubmitPartyWork)]
    public async Task<ActionResult<KeyEnvelopeDto>> CreateHandoff(
        Guid id,
        [FromBody] CreateKeyEnvelopeHandoffRequest request,
        CancellationToken ct)
    {
        var (envelope, error) = await _envelopes.CreateHandoffAsync(
            id, request, ActorId(), ActorName(), ct);
        if (error is not null)
            return error.Contains("غير موجود") ? NotFound(new { message = error })
                : BadRequest(new { message = error });
        return Ok(envelope);
    }

    [HttpPost("{id:guid}/handoffs/{handoffId:guid}/confirm")]
    [Authorize(Policy = CapabilityPolicyNames.SubmitPartyWork)]
    public async Task<ActionResult<KeyEnvelopeDto>> ConfirmHandoff(
        Guid id,
        Guid handoffId,
        CancellationToken ct)
    {
        var (envelope, error) = await _envelopes.ConfirmHandoffAsync(
            id, handoffId, ActorId(), ActorName(), ct);
        if (error is not null)
            return error.Contains("غير موجود") ? NotFound(new { message = error })
                : BadRequest(new { message = error });
        return Ok(envelope);
    }

    [HttpPut("court-access")]
    [Authorize(Policy = CapabilityPolicyNames.SubmitPartyWork)]
    public async Task<ActionResult<PropertyCourtAccessDto>> UpsertCourtAccess(
        [FromBody] UpsertPropertyCourtAccessRequest request,
        CancellationToken ct)
    {
        var (access, error) = await _envelopes.UpsertCourtAccessAsync(
            request, ActorId(), ActorName(), ct);
        if (error is not null)
            return error.Contains("غير موجود") ? NotFound(new { message = error })
                : BadRequest(new { message = error });
        return Ok(access);
    }
}
