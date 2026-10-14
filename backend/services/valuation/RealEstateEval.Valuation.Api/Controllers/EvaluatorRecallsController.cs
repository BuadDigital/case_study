using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Shared.Web;
using RealEstateEval.Shared.Web.Authorization;
using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Application.Abstractions;

namespace RealEstateEval.Valuation.Api.Controllers;

/// <summary>
/// The appraiser's «استرجاع التقرير» requests. Reads go to the case staff who run the
/// transaction (the report policy admits manage-work-orders); the decision belongs to the case
/// specialist alone — the capability only gets a caller to the door, the role check decides.
/// </summary>
[ApiController]
[Route("api/evaluator-recalls")]
[Authorize]
public class EvaluatorRecallsController(
    IEvaluatorRecallsService recalls,
    IPermissionService permissions) : ControllerBase
{
    public const string DecisionForbiddenAr = "قرار استرجاع التقييم للأخصائي فقط";

    [HttpGet]
    [Authorize(Policy = CapabilityPolicyNames.ReadValuationReport)]
    public async Task<ActionResult<IReadOnlyList<EvaluatorRecallDto>>> List(CancellationToken ct)
        => Ok(await recalls.ListAsync(ct));

    [HttpGet("{taskId}")]
    [Authorize(Policy = CapabilityPolicyNames.ReadValuationReport)]
    public async Task<ActionResult<EvaluatorRecallDto>> Get(string taskId, CancellationToken ct)
    {
        var dto = await recalls.GetAsync(taskId, ct);
        return this.OkOrEmpty(dto);
    }

    [HttpPost]
    [Authorize(Policy = CapabilityPolicyNames.SubmitValuationReport)]
    public async Task<ActionResult<EvaluatorRecallDto>> SubmitRequest(
        [FromBody] CreateEvaluatorRecallRequest request,
        CancellationToken ct)
    {
        var (dto, error) = await recalls.RequestAsync(request, ct);
        if (dto is null) return this.BadRequestProblem(error ?? "طلب غير صالح");
        return CreatedAtAction(nameof(Get), new { taskId = dto.TaskId }, dto);
    }

    [HttpPatch("{taskId}/decide")]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public Task<ActionResult<EvaluatorRecallDto>> Decide(
        string taskId,
        [FromBody] DecideEvaluatorRecallRequest request,
        CancellationToken ct)
        => DecideAsCaseSpecialistAsync(taskId, request, ct);

    // Old routes stay for a rolling deploy; they carry the same rule as /decide.
    [HttpPatch("{taskId}/approve")]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public Task<ActionResult<EvaluatorRecallDto>> Approve(string taskId, CancellationToken ct)
        => DecideAsCaseSpecialistAsync(
            taskId,
            new DecideEvaluatorRecallRequest { Decision = EvaluatorRecallDecisions.Approve },
            ct);

    [HttpPatch("{taskId}/reject")]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public Task<ActionResult<EvaluatorRecallDto>> Reject(
        string taskId,
        [FromBody] RejectEvaluatorRecallRequest request,
        CancellationToken ct)
        => DecideAsCaseSpecialistAsync(
            taskId,
            new DecideEvaluatorRecallRequest
            {
                Decision = EvaluatorRecallDecisions.Reject,
                Note = request.SpecialistNote,
            },
            ct);

    private async Task<ActionResult<EvaluatorRecallDto>> DecideAsCaseSpecialistAsync(
        string taskId,
        DecideEvaluatorRecallRequest request,
        CancellationToken ct)
    {
        var actor = await permissions.GetForUserIdAsync(ActorClaims.Id(User), ct);
        if (!PoRoleMatrixRules.CanDecideAppraisalRecall(actor?.PrototypeRole))
            return this.ForbiddenProblem(DecisionForbiddenAr);

        var (dto, errors) = await recalls.DecideAsync(taskId, request, ct, actor?.UserId);
        if (errors is not null)
        {
            return errors.ContainsKey(EvaluatorRecallDecisions.UpstreamErrorKey)
                ? this.FieldErrorsProblem(
                    errors, StatusCodes.Status503ServiceUnavailable, "Service Unavailable")
                : this.FieldErrorsProblem(errors);
        }

        return dto is null ? NotFound() : Ok(dto);
    }
}
