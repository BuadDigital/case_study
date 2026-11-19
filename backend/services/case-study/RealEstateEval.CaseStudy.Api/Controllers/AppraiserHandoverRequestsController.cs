using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.Shared.Web;
using RealEstateEval.Shared.Web.Authorization;

namespace RealEstateEval.CaseStudy.Api.Controllers;

/// <summary>
/// The appraiser's reassignment requests and peer transfers (Omar 2026-11-18). The appraiser asks or
/// transfers; the specialist who handed him the transaction (then his team) takes and completes a request.
/// Role rules live in the service; this controller turns the caller into an actor and results into HTTP.
/// </summary>
[ApiController]
[Route("api/appraiser-handover-requests")]
[Authorize(Policy = CapabilityPolicyNames.ReadCaseStudyWorkspace)]
public sealed class AppraiserHandoverRequestsController(
    IAppraiserHandoverService handovers,
    IPermissionService permissions) : ControllerBase
{
    /// <summary>The open requests the caller sees.</summary>
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<AppraiserHandoverRequestDto>>> List(CancellationToken ct) =>
        Ok(await handovers.ListOpenAsync(await ActorAsync(ct), ct));

    [HttpPost("reassign")]
    [Authorize(Policy = CapabilityPolicyNames.SubmitPartyWork)]
    public async Task<ActionResult<AppraiserHandoverRequestDto>> RequestReassignment(
        [FromBody] RequestAppraiserReassignmentRequest request, CancellationToken ct) =>
        Respond(await handovers.RequestReassignmentAsync(request, await ActorAsync(ct), ct));

    [HttpPost("peer")]
    [Authorize(Policy = CapabilityPolicyNames.SubmitPartyWork)]
    public async Task<ActionResult<AppraiserHandoverRequestDto>> RequestPeerTransfer(
        [FromBody] RequestPeerTransferRequest request, CancellationToken ct) =>
        Respond(await handovers.RequestPeerTransferAsync(request, await ActorAsync(ct), ct));

    [HttpPost("{id:guid}/accept")]
    [Authorize(Policy = CapabilityPolicyNames.SubmitPartyWork)]
    public async Task<ActionResult<AppraiserHandoverRequestDto>> Accept(Guid id, CancellationToken ct) =>
        Respond(await handovers.AcceptPeerAsync(id, await ActorAsync(ct), ct));

    [HttpPost("{id:guid}/decline")]
    [Authorize(Policy = CapabilityPolicyNames.SubmitPartyWork)]
    public async Task<ActionResult<AppraiserHandoverRequestDto>> Decline(
        Guid id, [FromBody] CloseAppraiserHandoverRequest request, CancellationToken ct) =>
        Respond(await handovers.DeclinePeerAsync(id, request, await ActorAsync(ct), ct));

    [HttpPost("{id:guid}/cancel")]
    [Authorize(Policy = CapabilityPolicyNames.SubmitPartyWork)]
    public async Task<ActionResult<AppraiserHandoverRequestDto>> Cancel(
        Guid id, [FromBody] CloseAppraiserHandoverRequest request, CancellationToken ct) =>
        Respond(await handovers.CancelAsync(id, request, await ActorAsync(ct), ct));

    [HttpPost("{id:guid}/take")]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<ActionResult<AppraiserHandoverRequestDto>> Take(Guid id, CancellationToken ct) =>
        Respond(await handovers.TakeAsync(id, await ActorAsync(ct), ct));

    [HttpPost("{id:guid}/complete")]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<ActionResult<AppraiserHandoverRequestDto>> Complete(
        Guid id, [FromBody] CompleteAppraiserReassignmentRequest request, CancellationToken ct) =>
        Respond(await handovers.CompleteReassignmentAsync(id, request, await ActorAsync(ct), ct));

    private ActionResult<AppraiserHandoverRequestDto> Respond(
        (AppraiserHandoverRequestDto? Result, Dictionary<string, string>? Errors) outcome) =>
        outcome.Errors is null ? Ok(outcome.Result) : this.FieldErrorsProblem(outcome.Errors);

    private Task<PartySubmissionActor> ActorAsync(CancellationToken ct) =>
        PartySubmissionActors.ResolveAsync(User, permissions, ct);
}
