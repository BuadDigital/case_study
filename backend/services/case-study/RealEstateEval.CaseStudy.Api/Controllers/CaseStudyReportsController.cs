using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Shared.Web;
using RealEstateEval.Shared.Web.Authorization;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Application.Services;

namespace RealEstateEval.CaseStudy.Api.Controllers;

[ApiController]
[Route("api/case-study-reports")]
[Authorize]
public class CaseStudyReportsController : ControllerBase
{
    private readonly ICaseStudyReportService _forms;
    private readonly ICaseStudyReportBatchReadService _batch;
    private readonly IPermissionService _permissions;

    public CaseStudyReportsController(
        ICaseStudyReportService forms,
        ICaseStudyReportBatchReadService batch,
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
    /// at most <see cref="CaseStudyReportBatchReadService.MaxParentTaskIds"/> distinct GUIDs.
    /// Not paged: the caller already holds the row window it is decorating.
    /// </summary>
    [HttpGet("batch")]
    [Authorize(Policy = CapabilityPolicyNames.ReadCaseStudyWorkspace)]
    public async Task<ActionResult<CaseStudyReportBatchDto>> GetBatch(
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

        if (ids.Distinct().Count() > CaseStudyReportBatchReadService.MaxParentTaskIds)
        {
            return this.FieldErrorsProblem(new Dictionary<string, string>
            {
                ["parentTaskIds"] =
                    $"الحد الأقصى {CaseStudyReportBatchReadService.MaxParentTaskIds} معرّفاً في الطلب الواحد",
            });
        }

        var dto = await _batch.GetForParentsAsync(
            ids,
            await ResolveActorAsync(cancellationToken),
            cancellationToken);
        return Ok(dto);
    }

    [HttpGet("{taskId:guid}")]
    [Authorize(Policy = CapabilityPolicyNames.ReadCaseStudyWorkspace)]
    public async Task<ActionResult<CaseStudyReportDto>> Get(
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
    public async Task<ActionResult<CaseStudyReportDto>> Save(
        Guid taskId,
        [FromBody] SaveCaseStudyReportRequest request,
        CancellationToken cancellationToken)
    {
        var (result, errors) = await _forms.SaveAsync(
            taskId,
            party: false,
            request.Report,
            await ResolveActorAsync(cancellationToken),
            cancellationToken);
        if (errors is not null)
        {
            // The compat route for «issued» (one release) can refuse on the specialist-only rule.
            if (errors.TryGetValue("_", out var msg)
                && msg.Contains("صلاحية", StringComparison.Ordinal))
            {
                return this.FieldErrorsProblem(errors, StatusCodes.Status403Forbidden, "Forbidden");
            }
            return this.FieldErrorsProblem(errors);
        }
        return Ok(result);
    }

    /// <summary>
    /// Issues the case-study report: the specialist's final state in the body, judged by the role rule,
    /// the failure and deed-match gates, and the 100% completeness rule (error keys <c>answers</c> and
    /// <c>missingQuestionKeys</c>); then the report, the parent task and the party-form lock commit as one.
    /// This is what opens the appraiser's submission. Case specialist only (403 otherwise).
    /// </summary>
    [HttpPost("{taskId:guid}/issue")]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<ActionResult<CaseStudyReportDto>> Issue(
        Guid taskId,
        [FromBody] IssueCaseStudyReportRequest request,
        CancellationToken cancellationToken)
    {
        var actor = await ResolveActorAsync(cancellationToken);
        if (!PoRoleMatrixRules.CanIssueCaseStudyReport(actor.PrototypeRole))
            return this.ForbiddenProblem(CaseStudyReportService.IssueRoleDeniedAr);

        var (result, errors) = await _forms.IssueAsync(
            taskId,
            request?.Report ?? new CaseStudyReportDto(),
            actor,
            cancellationToken);
        if (errors is not null) return this.FieldErrorsProblem(errors);
        if (result is null) return this.NotFoundProblem("المهمة غير موجودة.");
        return Ok(result);
    }

    /// <summary>
    /// Reopens an issued report with a mandatory reason (≥ 10 characters): report back to draft, parent
    /// task back to open, still-open parties unlocked. A transaction already handed over to Enfaz answers
    /// 409 (<c>enfazHandover</c>) unless <c>clearEnfazHandover</c> confirms clearing the stamp.
    /// Case specialist only (403 otherwise).
    /// </summary>
    [HttpPost("{taskId:guid}/reopen")]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<ActionResult<ReopenCaseStudyReportResultDto>> Reopen(
        Guid taskId,
        [FromBody] ReopenCaseStudyReportRequest request,
        CancellationToken cancellationToken)
    {
        var actor = await ResolveActorAsync(cancellationToken);
        if (!PoRoleMatrixRules.CanReopenCaseStudyReport(actor.PrototypeRole))
            return this.ForbiddenProblem(CaseStudyReportService.ReopenRoleDeniedAr);

        var (result, errors) = await _forms.ReopenAsync(
            taskId,
            request?.Reason,
            request?.ClearEnfazHandover ?? false,
            actor,
            cancellationToken);
        if (errors is not null)
        {
            return errors.ContainsKey(CaseStudyReportService.EnfazHandoverKey)
                ? this.FieldErrorsProblem(errors, StatusCodes.Status409Conflict, "Conflict")
                : this.FieldErrorsProblem(errors);
        }
        if (result is null) return this.NotFoundProblem("المهمة غير موجودة.");
        return Ok(result);
    }

    [HttpGet("party/{taskId:guid}")]
    [Authorize(Policy = CapabilityPolicyNames.ReadCaseStudyWorkspace)]
    public async Task<ActionResult<CaseStudyReportDto>> GetParty(
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
    public async Task<ActionResult<CaseStudyReportDto>> SaveParty(
        Guid taskId,
        [FromBody] SaveCaseStudyReportRequest request,
        CancellationToken cancellationToken)
    {
        var (result, errors) = await _forms.SaveAsync(
            taskId,
            party: true,
            request.Report,
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

    private async Task<CaseStudyReportActor> ResolveActorAsync(CancellationToken ct)
    {
        var userId = ActorClaims.Id(User);
        var permissions = string.IsNullOrWhiteSpace(userId) || userId == "unknown"
            ? null
            : await _permissions.GetForUserIdAsync(userId, ct);

        return new CaseStudyReportActor
        {
            UserId = userId,
            DisplayName = ActorClaims.DisplayName(User),
            PrototypeRole = permissions?.PrototypeRole,
            DistributionAssigneeId = permissions?.DistributionAssigneeId,
        };
    }
}