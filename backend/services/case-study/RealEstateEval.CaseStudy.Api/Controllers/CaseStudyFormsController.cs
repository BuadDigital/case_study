using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Web;
using RealEstateEval.Shared.Web.Authorization;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Application.Services;

namespace RealEstateEval.CaseStudy.Api.Controllers;

[ApiController]
[Route("api/case-study-forms")]
[Authorize]
public class CaseStudyFormsController : ControllerBase
{
    private readonly ICaseStudyFormService _forms;
    private readonly ICaseStudyFormBatchReadService _batch;
    private readonly IPermissionService _permissions;

    public CaseStudyFormsController(
        ICaseStudyFormService forms,
        ICaseStudyFormBatchReadService batch,
        IPermissionService permissions)
    {
        _forms = forms;
        _batch = batch;
        _permissions = permissions;
    }

    /// <summary>
    /// One read for many queue rows: the case-study form of every listed parent plus the party
    /// forms of its children, keyed by id. Same visibility rule as the two single-item GETs —
    /// an id the actor may not read is simply absent. <c>parentTaskIds</c> is comma-separated,
    /// at most <see cref="CaseStudyFormBatchReadService.MaxParentTaskIds"/> distinct GUIDs.
    /// Not paged: the caller already holds the row window it is decorating.
    /// </summary>
    [HttpGet("batch")]
    public async Task<ActionResult<CaseStudyFormBatchDto>> GetBatch(
        [FromQuery] string? parentTaskIds,
        CancellationToken cancellationToken)
    {
        var ids = new List<Guid>();
        foreach (var raw in (parentTaskIds ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            if (!Guid.TryParse(raw, out var id))
            {
                return this.FieldErrorsProblem(new Dictionary<string, string>
                {
                    ["parentTaskIds"] = "معرّف مهمة غير صالح",
                });
            }
            ids.Add(id);
        }

        if (ids.Distinct().Count() > CaseStudyFormBatchReadService.MaxParentTaskIds)
        {
            return this.FieldErrorsProblem(new Dictionary<string, string>
            {
                ["parentTaskIds"] =
                    $"الحد الأقصى {CaseStudyFormBatchReadService.MaxParentTaskIds} معرّفاً في الطلب الواحد",
            });
        }

        var dto = await _batch.GetForParentsAsync(
            ids,
            await ResolveActorAsync(cancellationToken),
            cancellationToken);
        return Ok(dto);
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