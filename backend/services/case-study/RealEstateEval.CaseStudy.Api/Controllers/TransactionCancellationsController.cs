using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Shared.Web;
using RealEstateEval.Shared.Web.Authorization;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Rules;

namespace RealEstateEval.CaseStudy.Api.Controllers;

/// <summary>
/// «إلغاء المعاملة»: preview, request (case specialist), approve / reject and reactivate (section
/// supervisor), and the state the property page shows. Role rules live in the service; this
/// controller only turns the caller into an actor and the results into HTTP.
/// </summary>
[ApiController]
[Route("api/transaction-cancellations")]
[Authorize(Policy = CapabilityPolicyNames.ReadCaseStudyWorkspace)]
public sealed class TransactionCancellationsController(
    ITransactionCancellationService cancellations,
    IPermissionService permissions) : ControllerBase
{
    /// <summary>What a request for this deed's transaction (propertyId) or this work order (poNumber) would cancel.</summary>
    [HttpGet("preview")]
    public async Task<ActionResult<TransactionCancellationPreviewDto>> Preview(
        [FromQuery] Guid? propertyId,
        [FromQuery] string? poNumber,
        CancellationToken ct)
    {
        var (result, error) = await cancellations.PreviewAsync(propertyId, poNumber, ct);
        return error is not null ? this.BadRequestProblem(error) : Ok(result);
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<TransactionCancellationDto>>> List(
        [FromQuery] string? status,
        CancellationToken ct) =>
        Ok(await cancellations.ListAsync(status, ct));

    [HttpGet("by-property/{propertyId:guid}")]
    public async Task<ActionResult<TransactionCancellationStateDto>> ForProperty(Guid propertyId, CancellationToken ct) =>
        Ok(await cancellations.GetForPropertyAsync(propertyId, ct));

    [HttpPost]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<ActionResult<TransactionCancellationDto>> Create(
        [FromBody] RequestTransactionCancellationRequest request,
        CancellationToken ct) =>
        Respond(await cancellations.RequestAsync(request, await ActorAsync(ct), ct));

    [HttpPost("{id:guid}/approve")]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<ActionResult<TransactionCancellationDto>> Approve(
        Guid id,
        [FromBody] DecideTransactionCancellationRequest request,
        CancellationToken ct) =>
        Respond(await cancellations.ApproveAsync(id, request, await ActorAsync(ct), ct));

    [HttpPost("{id:guid}/reject")]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<ActionResult<TransactionCancellationDto>> Reject(
        Guid id,
        [FromBody] DecideTransactionCancellationRequest request,
        CancellationToken ct) =>
        Respond(await cancellations.RejectAsync(id, request, await ActorAsync(ct), ct));

    [HttpPost("{id:guid}/reactivate")]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<ActionResult<TransactionCancellationDto>> Reactivate(
        Guid id,
        [FromBody] ReactivateTransactionCancellationRequest request,
        CancellationToken ct) =>
        Respond(await cancellations.ReactivateAsync(id, request, await ActorAsync(ct), ct));

    /// <summary>A role refusal is 403, any other refusal 400, else the request.</summary>
    private ActionResult<TransactionCancellationDto> Respond(
        (TransactionCancellationDto? Result, string? Error) outcome)
    {
        if (outcome.Error is null) return Ok(outcome.Result);
        return outcome.Error is TransactionCancellationRules.ForbiddenRequestAr
            or TransactionCancellationRules.ForbiddenDecideAr
            ? this.ForbiddenProblem(outcome.Error)
            : this.BadRequestProblem(outcome.Error);
    }

    private async Task<TransactionCancellationActor> ActorAsync(CancellationToken ct)
    {
        var userId = ActorClaims.Id(User);
        var perms = string.IsNullOrWhiteSpace(userId) || userId == "unknown"
            ? null
            : await permissions.GetForUserIdAsync(userId, ct);
        var name = ActorClaims.DisplayName(User);
        if (string.IsNullOrWhiteSpace(name)) name = perms?.DisplayName ?? "";
        return new TransactionCancellationActor(userId, name, perms?.PrototypeRole);
    }
}
