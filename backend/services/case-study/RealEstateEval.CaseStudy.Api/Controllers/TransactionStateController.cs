using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Rules;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.Shared.Web;
using RealEstateEval.Shared.Web.Authorization;

namespace RealEstateEval.CaseStudy.Api.Controllers;

/// <summary>
/// transaction state derived from party states (distribution network and dependencies — the Inspector is the key
/// key) + second conclusion: Upload the Transaction on Enfaz.
/// </summary>
[ApiController]
[Route("api/work-orders/{workOrderId:guid}/properties/{propertyId:guid}/transaction-state")]
[Authorize]
public class TransactionStateController : ControllerBase
{
    public const string HandoverForbiddenAr =
        "رفع المعاملة على إنفاذ لأخصائي دراسة الحالة فقط";

    public const string ReturnForbiddenAr =
        "استرجاع المعاملة من إنفاذ لأخصائي دراسة الحالة فقط";

    /// <summary>The refusal for any role other than the financial officer on the billing-ready mark.</summary>
    public const string BillingReadyForbiddenAr =
        "تعليم الصك «جاهز للفوترة» لموظف الشؤون المالية فقط";

    private readonly ITransactionStateService _state;
    private readonly IPermissionService _permissions;

    public TransactionStateController(
        ITransactionStateService state,
        IPermissionService permissions)
    {
        _state = state;
        _permissions = permissions;
    }

    [HttpGet]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<ActionResult<TransactionStateDto>> Get(
        Guid workOrderId,
        Guid propertyId,
        CancellationToken ct)
    {
        var state = await _state.GetStateAsync(workOrderId, propertyId, ct);
        return state is null ? NotFound() : Ok(state);
    }

    [HttpPost("enfaz-handover")]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<ActionResult<TransactionStateDto>> RecordHandover(
        Guid workOrderId,
        Guid propertyId,
        CancellationToken ct)
    {
        // The capability only reaches the door: handing over to Enfaz is the case specialist's call.
        if (!PoRoleMatrixRules.CanHandOverToEnfaz(await ActorPrototypeRoleAsync(ct)))
            return this.ForbiddenProblem(HandoverForbiddenAr);

        var (result, error) = await _state.RecordEnfazHandoverAsync(
            workOrderId,
            propertyId,
            ActorClaims.Id(User),
            ct);
        if (error is not null)
            return this.FieldErrorsProblem(new Dictionary<string, string> { ["_"] = error });
        return Ok(result);
    }

    /// <summary>
    /// The accountant marks the handed-over deed «جاهز للفوترة» once its financial data appeared on
    /// the Enfaz platform. The door is the financial capability; the role check follows.
    /// </summary>
    /// <remarks>
    /// How it works: 1) the ManageFinancial policy lets the request in. 2) The actor's PROTOTYPE role is
    /// resolved (the JWT carries identity roles, so it is read from the permission service, falling back
    /// to the token role) and must pass CanMarkBillingReady — otherwise 403 with the Arabic reason.
    /// 3) The service marks the deed and returns the new transaction state; a refusal (deed not handed
    /// over, removed, unknown) is returned as the field error «_» with the Arabic text.
    /// Edge cases: marking twice is safe (idempotent, 200 with the original stamp); the route is per deed
    /// (work order + property), so marking one deed of a work order never marks its siblings.
    /// </remarks>
    [HttpPost("billing-ready")]
    [Authorize(Policy = CapabilityPolicyNames.ManageFinancial)]
    public async Task<ActionResult<TransactionStateDto>> MarkBillingReady(
        Guid workOrderId,
        Guid propertyId,
        CancellationToken ct)
    {
        if (!PoRoleMatrixRules.CanMarkBillingReady(await ActorPrototypeRoleAsync(ct)))
            return this.ForbiddenProblem(BillingReadyForbiddenAr);

        var (result, error) = await _state.MarkBillingReadyAsync(
            workOrderId,
            propertyId,
            ActorClaims.Id(User),
            ct);
        if (error is not null)
            return this.FieldErrorsProblem(new Dictionary<string, string> { ["_"] = error });
        return Ok(result);
    }

    /// <summary>
    /// The case specialist takes the transaction back from Enfaz: clears the handover stamp and,
    /// as chosen, reopens the study report (and records the valuation request).
    /// </summary>
    [HttpPost("enfaz-return")]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<ActionResult<TransactionStateDto>> ReturnFromEnfaz(
        Guid workOrderId,
        Guid propertyId,
        [FromBody] ReturnFromEnfazRequest request,
        CancellationToken ct)
    {
        var userId = ActorClaims.Id(User);
        var known = !string.IsNullOrWhiteSpace(userId) && userId != "unknown";
        var permissions = known ? await _permissions.GetForUserIdAsync(userId, ct) : null;
        var role = permissions?.PrototypeRole;
        if (!PoRoleMatrixRules.CanReturnFromEnfaz(role))
            return this.ForbiddenProblem(ReturnForbiddenAr);

        var (result, errors) = await _state.ReturnFromEnfazAsync(
            workOrderId,
            propertyId,
            request ?? new ReturnFromEnfazRequest(),
            new CaseStudyReportActor
            {
                UserId = known ? userId : "",
                DisplayName = ActorClaims.DisplayName(User),
                PrototypeRole = role,
                DistributionAssigneeId = permissions?.DistributionAssigneeId,
            },
            ct);
        if (errors is not null)
            return this.FieldErrorsProblem(errors);
        return Ok(result);
    }

    /// <summary>JWT carries identity roles (Editor/CDO), not prototype roles.</summary>
    private async Task<string> ActorPrototypeRoleAsync(CancellationToken cancellationToken)
    {
        var userId = ActorClaims.Id(User);
        if (string.IsNullOrWhiteSpace(userId) || userId == "unknown") return "";
        var permissions = await _permissions.GetForUserIdAsync(userId, cancellationToken);
        var resolved = permissions?.PrototypeRole;
        if (!string.IsNullOrWhiteSpace(resolved))
            return resolved;
        return ActorClaims.Role(User) ?? "";
    }
}
