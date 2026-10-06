using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Services;
using RealEstateEval.Shared.Web;

namespace RealEstateEval.CaseStudy.Api.Controllers;

/// <summary>
/// Trusted valuation→case-study call behind an approved appraiser recall. Valuation has already
/// checked the deciding specialist; the forwarded bearer is that specialist, and the service
/// re-checks the role so the route is not a back door. Same upstream-only rule as
/// <see cref="CaseStudyDispatchController"/>.
/// </summary>
[ApiController]
[Route("api/case-study-dispatch/party-submissions")]
[Authorize]
[RequireUpstreamDispatch]
public sealed class CaseStudyRecallDispatchController(
    IPartyTaskSubmissionService submissions,
    IPermissionService permissions) : ControllerBase
{
    [HttpPost("{taskId:guid}/reopen-for-recall")]
    public async Task<ActionResult<PartyTaskSubmissionDto>> ReopenForRecall(
        Guid taskId,
        [FromBody] ReopenForRecallRequest request,
        CancellationToken cancellationToken)
    {
        var actor = await ResolveActorAsync(cancellationToken);

        var (result, errors) = await submissions.ReopenForRecallAsync(
            taskId, request ?? new ReopenForRecallRequest(), actor, cancellationToken);
        if (errors is null) return Ok(result);

        return RecallErrors(errors, PartyTaskSubmissionService.RecallReopenForbiddenAr);
    }

    /// <summary>A deposited report reopened as a new version (n+1): the appraiser's package and task open again.</summary>
    [HttpPost("{taskId:guid}/reopen-for-new-version")]
    public async Task<ActionResult<PartyTaskSubmissionDto>> ReopenForNewVersion(
        Guid taskId,
        [FromBody] ReopenForNewVersionRequest request,
        CancellationToken cancellationToken)
    {
        var actor = await ResolveActorAsync(cancellationToken);
        var (result, errors) = await submissions.ReopenForNewVersionAsync(
            taskId, request ?? new ReopenForNewVersionRequest(), actor, cancellationToken);
        if (errors is null) return Ok(result);

        return RecallErrors(errors, PartyTaskSubmissionService.NewVersionForbiddenAr);
    }

    private async Task<PartySubmissionActor> ResolveActorAsync(CancellationToken cancellationToken)
    {
        var userId = ActorClaims.Id(User);
        var known = !string.IsNullOrWhiteSpace(userId) && userId != "unknown";
        var perms = known ? await permissions.GetForUserIdAsync(userId, cancellationToken) : null;
        return new PartySubmissionActor
        {
            UserId = known ? userId : "",
            DisplayName = ActorClaims.DisplayName(User),
            PrototypeRole = perms?.PrototypeRole,
            DistributionAssigneeId = perms?.DistributionAssigneeId,
        };
    }

    private ActionResult RecallErrors(Dictionary<string, string> errors, string forbiddenMessage)
    {
        var message = errors.TryGetValue("_", out var text) ? text : "";
        if (message == forbiddenMessage)
            return this.FieldErrorsProblem(errors, StatusCodes.Status403Forbidden, "Forbidden");
        if (message == "المهمة غير موجودة")
            return NotFound();
        return this.FieldErrorsProblem(errors);
    }
}
