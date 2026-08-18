using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Authorization;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Web;
using RealEstateEval.Shared.Web.Authorization;

namespace RealEstateEval.CaseStudy.Api.Controllers;

[ApiController]
[Route("api/party-billing-statements")]
[Route("api/eng-billing-statements")] // legacy alias
[Authorize]
public class PartyBillingStatementsController : ControllerBase
{
    private readonly IPartyBillingStatementService _statements;
    private readonly IPermissionService _permissions;

    public PartyBillingStatementsController(
        IPartyBillingStatementService statements,
        IPermissionService permissions)
    {
        _statements = statements;
        _permissions = permissions;
    }

    [HttpGet("ready-lines")]
    [Authorize(Policy = CapabilityPolicyNames.ManageFinancial)]
    public async Task<ActionResult<IReadOnlyList<PartyBillingReadyLineDto>>> ListReadyLines(
        [FromQuery] string? assigneeId = null,
        CancellationToken ct = default) =>
        Ok(await _statements.ListReadyLinesAsync(assigneeId, ct));

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<PartyBillingStatementDto>>> List(
        [FromQuery] string? assigneeId = null,
        [FromQuery] string? status = null,
        [FromQuery] bool issuedOrLaterOnly = false,
        CancellationToken ct = default)
    {
        var ctx = await BuildActorContextAsync(ct);
        if (ctx.UserId is null) return Unauthorized();

 // Office: only own issued/closed statements.
        if (!ctx.IsFinancialOfficer && !ctx.IsOperationsManager)
        {
            if (string.IsNullOrWhiteSpace(ctx.AssigneeId))
                return Forbid();

            return Ok(await _statements.ListStatementsAsync(
                ctx.AssigneeId,
                status,
                issuedOrLaterOnly: true,
                ct));
        }

 // Supervisor visibility: issued+ by default unless finance filters.
        var issuedOnly = issuedOrLaterOnly
            || (ctx.IsOperationsManager && !ctx.IsFinancialOfficer);
        return Ok(await _statements.ListStatementsAsync(
            assigneeId,
            status,
            issuedOnly,
            ct));
    }

    [HttpPost]
    [Authorize(Policy = CapabilityPolicyNames.ManageFinancial)]
    public async Task<ActionResult<CreatePartyBillingStatementResponseDto>> Create(
        [FromBody] CreatePartyBillingStatementRequest request,
        CancellationToken ct)
    {
        var userId = CurrentUserId();
        if (userId is null) return Unauthorized();

        var result = await _statements.CreateStatementAsync(request, userId, ct);
        if (result.Error is not null)
            return this.BadRequestProblem(result.Error);
        return Ok(result);
    }

    [HttpPost("{statementId:guid}/issue")]
    [Authorize(Policy = CapabilityPolicyNames.ManageFinancial)]
    public async Task<ActionResult<PartyBillingStatementDto>> Issue(
        Guid statementId,
        CancellationToken ct)
    {
        var userId = CurrentUserId();
        if (userId is null) return Unauthorized();

        var (dto, error) = await _statements.IssueStatementAsync(statementId, userId, ct);
        if (error is not null)
            return this.BadRequestProblem(error);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPost("{statementId:guid}/submit-invoice")]
    public async Task<ActionResult<PartyBillingStatementDto>> SubmitVendorInvoice(
        Guid statementId,
        [FromBody] SubmitVendorInvoiceRequest request,
        CancellationToken ct)
    {
        var ctx = await BuildActorContextAsync(ct);
        if (ctx.UserId is null) return Unauthorized();

        var existing = await _statements.GetStatementAsync(statementId, ct);
        if (existing is null) return NotFound();

 // Finance or the assigned office may upload.
        var isOwner = !string.IsNullOrWhiteSpace(ctx.AssigneeId)
            && string.Equals(ctx.AssigneeId, existing.AssigneeId, StringComparison.Ordinal);
        if (!ctx.IsFinancialOfficer && !isOwner)
            return Forbid();

        var (dto, error) = await _statements.SubmitVendorInvoiceAsync(
            statementId, request, ctx.UserId, ct);
        if (error is not null)
            return this.BadRequestProblem(error);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPost("{statementId:guid}/match-invoice")]
    [Authorize(Policy = CapabilityPolicyNames.ManageFinancial)]
    public async Task<ActionResult<PartyBillingStatementDto>> MatchVendorInvoice(
        Guid statementId,
        CancellationToken ct)
    {
        var userId = CurrentUserId();
        if (userId is null) return Unauthorized();

        var (dto, error) = await _statements.MatchVendorInvoiceAsync(statementId, userId, ct);
        if (error is not null)
            return this.BadRequestProblem(error);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPost("{statementId:guid}/reject-invoice")]
    [Authorize(Policy = CapabilityPolicyNames.ManageFinancial)]
    public async Task<ActionResult<PartyBillingStatementDto>> RejectVendorInvoice(
        Guid statementId,
        [FromBody] RejectVendorInvoiceRequest request,
        CancellationToken ct)
    {
        var userId = CurrentUserId();
        if (userId is null) return Unauthorized();

        var (dto, error) = await _statements.RejectVendorInvoiceAsync(
            statementId, request, userId, ct);
        if (error is not null)
            return this.BadRequestProblem(error);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPost("{statementId:guid}/cancel")]
    [Authorize(Policy = CapabilityPolicyNames.ManageFinancial)]
    public async Task<ActionResult<PartyBillingStatementDto>> Cancel(
        Guid statementId,
        [FromBody] CancelPartyBillingStatementRequest request,
        CancellationToken ct)
    {
        var userId = CurrentUserId();
        if (userId is null) return Unauthorized();

        var (dto, error) = await _statements.CancelStatementAsync(
            statementId, request, userId, ct);
        if (error is not null)
            return this.BadRequestProblem(error);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPost("auto-month-vendor")]
    [Authorize(Policy = CapabilityPolicyNames.ManageFinancial)]
    public async Task<ActionResult<CreateMonthPartyBillingStatementsResponseDto>> CreateMonthVendor(
        CancellationToken ct)
    {
        var userId = CurrentUserId();
        if (userId is null) return Unauthorized();

        var result = await _statements.CreateMonthVendorStatementsAsync(userId, ct);
        if (result.Error is not null && result.Created.Count == 0)
            return this.BadRequestProblem(result.Error);
        return Ok(result);
    }

    [HttpPost("{statementId:guid}/close")]
    [Authorize(Policy = CapabilityPolicyNames.ManageFinancial)]
    public async Task<ActionResult<PartyBillingStatementDto>> Close(
        Guid statementId,
        [FromBody] ClosePartyBillingStatementRequest request,
        CancellationToken ct)
    {
        var userId = CurrentUserId();
        if (userId is null) return Unauthorized();

        var (dto, error) = await _statements.CloseStatementAsync(statementId, request, userId, ct);
        if (error is not null)
            return this.BadRequestProblem(error);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPost("defer-lines")]
    [Authorize(Policy = CapabilityPolicyNames.ManageFinancial)]
    public async Task<ActionResult<DeferPartyBillingLinesResponseDto>> DeferLines(
        [FromBody] DeferPartyBillingLinesRequest request,
        CancellationToken ct)
    {
        var userId = CurrentUserId();
        if (userId is null) return Unauthorized();

        return Ok(await _statements.DeferLinesAsync(request, userId, ct));
    }

    private string? CurrentUserId()
    {
        var id = ActorClaims.Id(User);
        return id is "unknown" or "" ? null : id;
    }

    private async Task<ActorContext> BuildActorContextAsync(CancellationToken ct)
    {
        var userId = CurrentUserId();
        var isOperationsManager = User.HasClaim(
            PlatformCapabilities.ClaimType,
            PlatformCapabilities.ManageOperations);
        var isFinancialOfficer = User.HasClaim(
            PlatformCapabilities.ClaimType,
            PlatformCapabilities.ManageFinancial);

        string? assigneeId = null;
        if (!string.IsNullOrWhiteSpace(userId))
        {
            var permissions = await _permissions.GetForUserIdAsync(userId, ct);
            assigneeId = permissions?.DistributionAssigneeId;
        }

        return new ActorContext(userId, assigneeId, isOperationsManager, isFinancialOfficer);
    }

    private sealed record ActorContext(
        string? UserId,
        string? AssigneeId,
        bool IsOperationsManager,
        bool IsFinancialOfficer);
}
