using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Shared.Web;
using RealEstateEval.Shared.Web.Authorization;
using RealEstateEval.Valuation.Application.Abstractions;
using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Application.Rules;

namespace RealEstateEval.Valuation.Api.Controllers;

/// <summary>
/// The valuation-report draft. After the appraiser hands his package over, the case specialist prepares
/// the report (his report choices) and sends it; the assigned appraiser approves it — which freezes the
/// report as the deposit copy — or takes his approval back. The capability only gets a caller to the
/// door: the role / assignment rules are enforced by the service (a refusal answers 403).
/// </summary>
[ApiController]
[Route("api/valuation-requests/{valuationRequestId:guid}/report-draft")]
[Authorize]
public class ValuationReportDraftsController(
    IValuationReportDraftService drafts,
    IPermissionService permissions) : ControllerBase
{
    [HttpGet]
    [Authorize(Policy = CapabilityPolicyNames.ReadValuationReport)]
    public async Task<ActionResult<ValuationReportDraftDto>> Get(Guid valuationRequestId, CancellationToken ct)
    {
        var dto = await drafts.GetAsync(valuationRequestId, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    /// <summary>The approved printed report exactly as the appraiser approved it.</summary>
    [HttpGet("snapshot")]
    [Authorize(Policy = CapabilityPolicyNames.ReadValuationReport)]
    public async Task<IActionResult> GetSnapshot(Guid valuationRequestId, CancellationToken ct)
    {
        var html = await drafts.GetApprovedSnapshotHtmlAsync(valuationRequestId, ct);
        return html is null ? NotFound() : Content(html, "text/html; charset=utf-8");
    }

    [HttpPut("choices")]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public Task<ActionResult<ValuationReportDraftDto>> SaveChoices(
        Guid valuationRequestId,
        [FromBody] SaveReportDraftChoicesRequest request,
        CancellationToken ct) =>
        RunAsync(actor => drafts.SaveChoicesAsync(valuationRequestId, request, actor, ct), ct);

    [HttpPost("send")]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public Task<ActionResult<ValuationReportDraftDto>> Send(
        Guid valuationRequestId,
        [FromBody] SendReportDraftRequest request,
        CancellationToken ct) =>
        RunAsync(actor => drafts.SendAsync(valuationRequestId, request, actor, ct), ct);

    [HttpPost("withdraw")]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public Task<ActionResult<ValuationReportDraftDto>> Withdraw(
        Guid valuationRequestId,
        [FromBody] WithdrawReportDraftRequest request,
        CancellationToken ct) =>
        RunAsync(actor => drafts.WithdrawAsync(valuationRequestId, request, actor, ct), ct);

    [HttpPost("approve")]
    [Authorize(Policy = CapabilityPolicyNames.SubmitValuationReport)]
    public Task<ActionResult<ValuationReportDraftDto>> Approve(
        Guid valuationRequestId,
        [FromBody] ApproveReportDraftRequest request,
        CancellationToken ct) =>
        RunAsync(actor => drafts.ApproveAsync(valuationRequestId, request, actor, ct), ct);

    [HttpPost("withdraw-approval")]
    [Authorize(Policy = CapabilityPolicyNames.SubmitValuationReport)]
    public Task<ActionResult<ValuationReportDraftDto>> WithdrawApproval(
        Guid valuationRequestId,
        [FromBody] WithdrawReportDraftRequest request,
        CancellationToken ct) =>
        RunAsync(actor => drafts.WithdrawApprovalAsync(valuationRequestId, request, actor, ct), ct);

    /// <summary>The generated final report PDF (the approved report with the deposit code + the certificate page).</summary>
    [HttpGet("final-report")]
    [Authorize(Policy = CapabilityPolicyNames.ReadValuationReport)]
    public async Task<IActionResult> DownloadFinalReport(Guid valuationRequestId, CancellationToken ct)
    {
        var actor = await ReportDraftActors.ResolveAsync(permissions, User, ct);
        var (file, errors) = await drafts.GetFinalReportAsync(valuationRequestId, actor, ct);
        if (errors is not null)
        {
            if (errors.TryGetValue(ReportDraftErrorKeys.Forbidden, out var forbidden))
                return this.ForbiddenProblem(forbidden);
            return this.ConflictProblem(errors.Values.FirstOrDefault() ?? "ملف التقرير النهائي قيد الإعداد");
        }

        return File(file!.Content, "application/pdf", file.FileName);
    }

    /// <summary>Retries generating the final report PDF (the renderer was unavailable, or the deposit code changed).</summary>
    [HttpPost("final-report/generate")]
    [Authorize(Policy = CapabilityPolicyNames.ReadValuationReport)]
    public async Task<IActionResult> GenerateFinalReport(Guid valuationRequestId, CancellationToken ct)
    {
        var actor = await ReportDraftActors.ResolveAsync(permissions, User, ct);
        var (status, errors) = await drafts.RegenerateFinalReportAsync(valuationRequestId, actor, ct);
        if (errors is not null)
        {
            if (errors.TryGetValue(ReportDraftErrorKeys.Forbidden, out var forbidden))
                return this.ForbiddenProblem(forbidden);
            return this.FieldErrorsProblem(errors);
        }

        return Ok(new FinalReportStatusDto { FinalReportStatus = status ?? "none" });
    }

    private async Task<ActionResult<ValuationReportDraftDto>> RunAsync(
        Func<ReportDraftActor, Task<(ValuationReportDraftDto? Result, Dictionary<string, string>? Errors)>> action,
        CancellationToken ct)
    {
        var actor = await ReportDraftActors.ResolveAsync(permissions, User, ct);
        var (result, errors) = await action(actor);
        if (errors is not null)
        {
            if (errors.TryGetValue(ReportDraftErrorKeys.Forbidden, out var forbidden))
                return this.ForbiddenProblem(forbidden);
            return this.FieldErrorsProblem(errors);
        }

        return result is null ? NotFound() : Ok(result);
    }
}
