using System;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Web;
using RealEstateEval.Shared.Web.Authorization;

namespace RealEstateEval.Operations.Api.Controllers;

[ApiController]
[Route("api/key-envelopes")]
[Route("api/key-envelopes/v1")]
[Authorize(Policy = CapabilityPolicyNames.ReadKeyData)]
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

    private ObjectResult ProblemForServiceError(string error) =>
        error.Contains("غير موجود", StringComparison.Ordinal)
            ? this.NotFoundProblem(error)
            : this.BadRequestProblem(error);

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<KeyEnvelopeDto>>> List(CancellationToken ct)
        => Ok(await _envelopes.ListAsync(ct));

    [HttpGet("fee-report")]
    public async Task<ActionResult<IReadOnlyList<KeyEnvelopeFeeReportRowDto>>> FeeReport(
        CancellationToken ct)
        => Ok(await _envelopes.ListFeeReportAsync(ct));

    /// <summary>
    /// Confirming collection is a finance act, so it sits behind <c>manage-financial</c> rather than
    /// the party-work gate the rest of this controller uses.
    /// </summary>
    [HttpPost("{id:guid}/fee-collected")]
    [Authorize(Policy = CapabilityPolicyNames.ManageFinancial)]
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
            return ProblemForServiceError(error);
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
            return this.BadRequestProblem("requestNumber مطلوب");
        return Ok(await _envelopes.ListLinkedPropertiesAsync(requestNumber, ct));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<KeyEnvelopeDto>> Get(Guid id, CancellationToken ct)
    {
        var row = await _envelopes.GetAsync(id, ct);
        return row is null ? this.NotFoundProblem("الظرف غير موجود.") : Ok(row);
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = CapabilityPolicyNames.SubmitPartyWork)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
        => await _envelopes.DeleteAsync(id, ct) ? NoContent() : this.NotFoundProblem("الظرف غير موجود.");

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
        if (error is not null) return this.BadRequestProblem(error);
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
            return ProblemForServiceError(error);
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
            return ProblemForServiceError(error);
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
            return ProblemForServiceError(error);
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
            return ProblemForServiceError(error);
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
            return ProblemForServiceError(error);
        return Ok(access);
    }
}
