using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Shared.Web;
using RealEstateEval.Shared.Web.Authorization;
using RealEstateEval.Valuation.Application.Rules;
using RealEstateEval.Valuation.Application.Abstractions;
using RealEstateEval.Valuation.Application.Contracts;

namespace RealEstateEval.Valuation.Api.Controllers;

/// <summary>
/// The report draft by property: the specialist's property page and the appraiser's report know the
/// property, not the valuation request — this resolves the property's latest request and returns its draft.
/// </summary>
[ApiController]
[Route("api/valuation-report-drafts")]
[Authorize]
public class ValuationReportDraftLookupController(
    IValuationReportDraftService drafts,
    IPermissionService permissions) : ControllerBase
{
    [HttpGet("by-property/{propertyId:guid}")]
    [Authorize(Policy = CapabilityPolicyNames.ReadValuationReport)]
    public async Task<ActionResult<ValuationReportDraftDto>> GetByProperty(Guid propertyId, CancellationToken ct)
    {
        var dto = await drafts.GetByPropertyAsync(propertyId, ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    /// <summary>Draft state of several properties for the queues' status labels (comma-separated ids, at most 200).</summary>
    [HttpGet("states")]
    [Authorize(Policy = CapabilityPolicyNames.ReadValuationReport)]
    public async Task<ActionResult<IReadOnlyList<ReportDraftStateDto>>> ListStates(
        [FromQuery] string? propertyIds,
        CancellationToken ct)
    {
        var ids = (propertyIds ?? "")
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(x => Guid.TryParse(x, out var id) ? id : (Guid?)null)
            .OfType<Guid>()
            .ToList();
        return Ok(await drafts.ListStatesAsync(ids, ct));
    }

    /// <summary>
    /// Review voids the appraiser's approval while returning the valuation to an appraiser (Omar
    /// 2026-11-18). Called by Case Study's return with the reviewer's forwarded bearer. Before a
    /// deposit code only; no open request → 204.
    /// </summary>
    [HttpPost("by-property/{propertyId:guid}/withdraw-approval-for-return")]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<ActionResult<ValuationReportDraftDto>> WithdrawApprovalForReturn(
        Guid propertyId,
        [FromBody] WithdrawReportDraftRequest request,
        CancellationToken ct)
    {
        var actor = await ReportDraftActors.ResolveAsync(permissions, User, ct);
        var (result, errors) = await drafts.WithdrawApprovalForReturnAsync(propertyId, request, actor, ct);
        if (errors is null) return result is null ? NoContent() : Ok(result);
        return errors.TryGetValue(ReportDraftErrorKeys.Forbidden, out var forbidden)
            ? this.ForbiddenProblem(forbidden)
            : this.FieldErrorsProblem(errors);
    }

    /// <summary>
    /// Reopens the property's deposited report as a new version (n+1) — what an Enfaz return and an approved
    /// recall of a deposited report do. The case specialist only (the forwarded bearer is his).
    /// </summary>
    [HttpPost("by-property/{propertyId:guid}/reopen-version")]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<ActionResult<ValuationReportIssuanceStateDto>> ReopenVersion(
        Guid propertyId,
        [FromBody] ReopenReportIssuanceRequest request,
        CancellationToken ct)
    {
        var actor = await ReportDraftActors.ResolveAsync(permissions, User, ct);
        var (result, errors) = await drafts.ReopenNewVersionByPropertyAsync(propertyId, request, actor, ct);
        if (errors is null) return Ok(result);
        return errors.TryGetValue(ReportDraftErrorKeys.Forbidden, out var forbidden)
            ? this.ForbiddenProblem(forbidden)
            : this.FieldErrorsProblem(errors);
    }
}
