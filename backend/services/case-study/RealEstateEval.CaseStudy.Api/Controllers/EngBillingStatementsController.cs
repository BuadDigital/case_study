using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Authorization;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Shared.Web.Authorization;

namespace RealEstateEval.CaseStudy.Api.Controllers;

[ApiController]
[Route("api/eng-billing-statements")]
[Authorize]
public class EngBillingStatementsController : ControllerBase
{
    private readonly IEngineeringBillingStatementService _statements;
    private readonly ApplicationDbContext _db;

    public EngBillingStatementsController(
        IEngineeringBillingStatementService statements,
        ApplicationDbContext db)
    {
        _statements = statements;
        _db = db;
    }

    [HttpGet("ready-lines")]
    [Authorize(Policy = CapabilityPolicyNames.ManageFinancial)]
    public async Task<ActionResult<IReadOnlyList<EngBillingReadyLineDto>>> ListReadyLines(
        [FromQuery] string? assigneeId = null,
        CancellationToken ct = default) =>
        Ok(await _statements.ListReadyLinesAsync(assigneeId, ct));

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<EngBillingStatementDto>>> List(
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

    [HttpGet("{statementId:guid}")]
    public async Task<ActionResult<EngBillingStatementDto>> Get(
        Guid statementId,
        CancellationToken ct)
    {
        var ctx = await BuildActorContextAsync(ct);
        if (ctx.UserId is null) return Unauthorized();

        var dto = await _statements.GetStatementAsync(statementId, ct);
        if (dto is null) return NotFound();

        if (!ctx.IsFinancialOfficer && !ctx.IsOperationsManager)
        {
            if (string.IsNullOrWhiteSpace(ctx.AssigneeId)
                || !string.Equals(dto.AssigneeId, ctx.AssigneeId, StringComparison.Ordinal)
                || dto.Status == "draft")
            {
                return Forbid();
            }
        }

        return Ok(dto);
    }

    [HttpPost]
    [Authorize(Policy = CapabilityPolicyNames.ManageFinancial)]
    public async Task<ActionResult<CreateEngBillingStatementResult>> Create(
        [FromBody] CreateEngBillingStatementRequest request,
        CancellationToken ct)
    {
        var userId = CurrentUserId();
        if (userId is null) return Unauthorized();

        var result = await _statements.CreateStatementAsync(request, userId, ct);
        if (result.Error is not null)
            return BadRequest(new { error = result.Error });
        return Ok(result);
    }

    [HttpPost("{statementId:guid}/issue")]
    [Authorize(Policy = CapabilityPolicyNames.ManageFinancial)]
    public async Task<ActionResult<EngBillingStatementDto>> Issue(
        Guid statementId,
        CancellationToken ct)
    {
        var userId = CurrentUserId();
        if (userId is null) return Unauthorized();

        var (dto, error) = await _statements.IssueStatementAsync(statementId, userId, ct);
        if (error is not null)
            return BadRequest(new { error });
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPost("{statementId:guid}/close")]
    [Authorize(Policy = CapabilityPolicyNames.ManageFinancial)]
    public async Task<ActionResult<EngBillingStatementDto>> Close(
        Guid statementId,
        [FromBody] CloseEngBillingStatementRequest request,
        CancellationToken ct)
    {
        var userId = CurrentUserId();
        if (userId is null) return Unauthorized();

        var (dto, error) = await _statements.CloseStatementAsync(statementId, request, userId, ct);
        if (error is not null)
            return BadRequest(new { error });
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpPost("defer-lines")]
    [Authorize(Policy = CapabilityPolicyNames.ManageFinancial)]
    public async Task<ActionResult<DeferEngBillingLinesResult>> DeferLines(
        [FromBody] DeferEngBillingLinesRequest request,
        CancellationToken ct)
    {
        var userId = CurrentUserId();
        if (userId is null) return Unauthorized();

        return Ok(await _statements.DeferLinesAsync(request, userId, ct));
    }

    private string? CurrentUserId() =>
        User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);

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
            assigneeId = await _db.UserProfiles.AsNoTracking()
                .Where(p => p.UserId == userId)
                .Select(p => p.DistributionAssigneeId)
                .FirstOrDefaultAsync(ct);
        }

        return new ActorContext(userId, assigneeId, isOperationsManager, isFinancialOfficer);
    }

    private sealed record ActorContext(
        string? UserId,
        string? AssigneeId,
        bool IsOperationsManager,
        bool IsFinancialOfficer);
}
