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
/// Q-6: two-phase issuance + deposit certificate — the frozen deposit copy is issued when the appraiser
/// approves the report draft (<c>report-draft/approve</c>); this controller records the Qeema deposit code and
/// certificate (final copy) and reopens a deposited report.
/// </summary>
[ApiController]
[Route("api/valuation-requests/{valuationRequestId:guid}/report-issuance")]
[Authorize]
public class ValuationReportIssuanceController : ControllerBase
{
    private readonly IValuationReportIssuanceService _issuance;
    private readonly IValuationReportDraftService _drafts;
    private readonly IPermissionService _permissions;

    public ValuationReportIssuanceController(
        IValuationReportIssuanceService issuance,
        IValuationReportDraftService drafts,
        IPermissionService permissions)
    {
        _issuance = issuance;
        _drafts = drafts;
        _permissions = permissions;
    }

    [HttpGet]
    [Authorize(Policy = CapabilityPolicyNames.ReadValuationReport)]
    public async Task<ActionResult<ValuationReportIssuanceStateDto>> GetState(
        Guid valuationRequestId,
        CancellationToken ct)
    {
        var state = await _issuance.GetStateAsync(valuationRequestId, ct);
        return state is null ? NotFound() : Ok(state);
    }

    /// <summary>
    /// The assigned appraiser records the Qeema deposit code and the one-page PDF certificate (both required):
    /// the final copy is issued. A later call corrects the code (audited, no new version).
    /// </summary>
    [HttpPost("certificate")]
    [Authorize(Policy = CapabilityPolicyNames.SubmitValuationReport)]
    public async Task<ActionResult<ValuationReportIssuanceStateDto>> RegisterCertificate(
        Guid valuationRequestId,
        [FromBody] RegisterDepositCertificateRequest request,
        CancellationToken ct)
    {
        var actor = await ReportDraftActors.ResolveAsync(_permissions, User, ct);
        var (result, errors) = await _drafts.RecordDepositAsync(valuationRequestId, request, actor, ct);
        return Respond(result, errors);
    }

    /// <summary>
    /// Reopens a deposited report as a new version (n+1) — the case specialist's decision. The appraiser's
    /// package and task open again in Case Study; the current copy is marked superseded and stays on file.
    /// </summary>
    [HttpPost("reopen")]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<ActionResult<ValuationReportIssuanceStateDto>> Reopen(
        Guid valuationRequestId,
        [FromBody] ReopenReportIssuanceRequest request,
        CancellationToken ct)
    {
        var actor = await ReportDraftActors.ResolveAsync(_permissions, User, ct);
        var (result, errors) = await _drafts.ReopenNewVersionAsync(valuationRequestId, request, actor, ct);
        return Respond(result, errors);
    }

    private ActionResult<ValuationReportIssuanceStateDto> Respond(
        ValuationReportIssuanceStateDto? result,
        Dictionary<string, string>? errors)
    {
        if (errors is null) return Ok(result);
        return errors.TryGetValue(ReportDraftErrorKeys.Forbidden, out var forbidden)
            ? this.ForbiddenProblem(forbidden)
            : this.FieldErrorsProblem(errors);
    }
}
