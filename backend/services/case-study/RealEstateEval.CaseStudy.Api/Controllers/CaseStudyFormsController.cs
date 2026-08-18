using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Web;
using RealEstateEval.Shared.Web.Authorization;

namespace RealEstateEval.CaseStudy.Api.Controllers;

[ApiController]
[Route("api/case-study-forms")]
[Authorize]
public class CaseStudyFormsController : ControllerBase
{
    private readonly ICaseStudyFormService _forms;
    private readonly IPermissionService _permissions;

    public CaseStudyFormsController(
        ICaseStudyFormService forms,
        IPermissionService permissions)
    {
        _forms = forms;
        _permissions = permissions;
    }

    [HttpGet("{taskId:guid}")]
    public async Task<ActionResult<CaseStudyFormDto>> Get(
        Guid taskId,
        CancellationToken cancellationToken)
    {
        var dto = await _forms.GetAsync(
            taskId,
            party: false,
            await ResolveActorAsync(cancellationToken),
            cancellationToken);
        if (dto is null) return NotFound();
        return Ok(dto);
    }

    [HttpPut("{taskId:guid}")]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<ActionResult<CaseStudyFormDto>> Save(
        Guid taskId,
        [FromBody] SaveCaseStudyFormRequest request,
        CancellationToken cancellationToken)
    {
        var (result, errors) = await _forms.SaveAsync(
            taskId,
            party: false,
            request.Form,
            await ResolveActorAsync(cancellationToken),
            cancellationToken);
        if (errors is not null) return this.FieldErrorsProblem(errors);
        return Ok(result);
    }

    [HttpGet("party/{taskId:guid}")]
    public async Task<ActionResult<CaseStudyFormDto>> GetParty(
        Guid taskId,
        CancellationToken cancellationToken)
    {
        var dto = await _forms.GetAsync(
            taskId,
            party: true,
            await ResolveActorAsync(cancellationToken),
            cancellationToken);
        if (dto is null) return NotFound();
        return Ok(dto);
    }

    [HttpPut("party/{taskId:guid}")]
    [Authorize(Policy = CapabilityPolicyNames.SubmitPartyWork)]
    public async Task<ActionResult<CaseStudyFormDto>> SaveParty(
        Guid taskId,
        [FromBody] SaveCaseStudyFormRequest request,
        CancellationToken cancellationToken)
    {
        var (result, errors) = await _forms.SaveAsync(
            taskId,
            party: true,
            request.Form,
            await ResolveActorAsync(cancellationToken),
            cancellationToken);
        if (errors is not null)
        {
            if (errors.TryGetValue("_", out var msg)
                && msg.Contains("صلاحية", StringComparison.Ordinal))
            {
                return this.FieldErrorsProblem(errors, StatusCodes.Status403Forbidden, "Forbidden");
            }
            return this.FieldErrorsProblem(errors);
        }
        return Ok(result);
    }

    private async Task<CaseStudyFormActor> ResolveActorAsync(CancellationToken ct)
    {
        var userId = ActorClaims.Id(User);
        var permissions = string.IsNullOrWhiteSpace(userId) || userId == "unknown"
            ? null
            : await _permissions.GetForUserIdAsync(userId, ct);

        return new CaseStudyFormActor
        {
            UserId = userId,
            DisplayName = ActorClaims.DisplayName(User),
            PrototypeRole = permissions?.PrototypeRole,
            DistributionAssigneeId = permissions?.DistributionAssigneeId,
        };
    }
}