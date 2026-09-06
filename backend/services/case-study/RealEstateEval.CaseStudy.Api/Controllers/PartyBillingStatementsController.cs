using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Authorization;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Infrastructure.Data;
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
    private readonly DatabaseOptions _dbOptions;

    public PartyBillingStatementsController(
        IPartyBillingStatementService statements,
        IPermissionService permissions,
        IOptions<DatabaseOptions>? dbOptions = null)
    {
        _statements = statements;
        _permissions = permissions;
        _dbOptions = dbOptions?.Value ?? new DatabaseOptions();
    }

 /// <summary>
 /// Ready dues. Sending page or pageSize returns PagedResultDto; without them the response stays
 /// the plain array. The rows are synthesised, so the page is cut over the materialised list.
 /// See docs/architecture/pagination-contract.md §9.2.
 /// </summary>
    [HttpGet("ready-lines")]
    [Authorize(Policy = CapabilityPolicyNames.ManageFinancial)]
    public async Task<IActionResult> ListReadyLines(
        [FromQuery] string? assigneeId = null,
        [FromQuery] int? page = null,
        [FromQuery] int? pageSize = null,
        [FromQuery] string? sort = null,
        [FromQuery] string? dir = null,
        [FromQuery] string? q = null,
        CancellationToken ct = default)
    {
        var query = new PartyBillingReadyLineListQuery
        {
            Page = page,
            PageSize = pageSize,
            Sort = sort,
            Dir = dir,
            Q = q,
            AssigneeId = assigneeId,
        };

        if (!query.IsPaged)
            return Ok(await _statements.ListReadyLinesAsync(query, ct));

        var (skip, take, resolvedPage, _) = NpgsqlConfiguration.ResolveListPaging(
            query.Page, query.PageSize, _dbOptions);
        return Ok(await _statements.ListReadyLinesPagedAsync(query, skip, take, resolvedPage, ct));
    }

 /// <summary>
 /// Statements. Sending page or pageSize returns PagedResultDto; without them the response stays
 /// the plain array. Actor narrowing (an office sees only its own issued-or-later statements) is
 /// folded into the query before it is forwarded, so the count is the actor's.
 /// See docs/architecture/pagination-contract.md §9.1.
 /// </summary>
    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] string? assigneeId = null,
        [FromQuery] string? status = null,
        [FromQuery] bool issuedOrLaterOnly = false,
        [FromQuery] int? page = null,
        [FromQuery] int? pageSize = null,
        [FromQuery] string? sort = null,
        [FromQuery] string? dir = null,
        [FromQuery] string? q = null,
        CancellationToken ct = default)
    {
        var ctx = await BuildActorContextAsync(ct);
        if (ctx.UserId is null) return Unauthorized();

        var narrowed = NarrowStatementList(ctx, assigneeId, issuedOrLaterOnly);
        if (narrowed is null) return Forbid();

        var query = new PartyBillingStatementListQuery
        {
            Page = page,
            PageSize = pageSize,
            Sort = sort,
            Dir = dir,
            Q = q,
            Status = status,
            AssigneeId = narrowed.Value.AssigneeId,
            IssuedOrLaterOnly = narrowed.Value.IssuedOrLaterOnly,
        };

        if (!query.IsPaged)
            return Ok(await _statements.ListStatementsAsync(query, ct));

        var (skip, take, resolvedPage, _) = NpgsqlConfiguration.ResolveListPaging(
            query.Page, query.PageSize, _dbOptions);
        return Ok(await _statements.ListStatementsPagedAsync(query, skip, take, resolvedPage, ct));
    }

 /// <summary>
 /// One statement, under the list's visibility rule: finance and operations managers see any
 /// statement; a payee sees only its own, once issued.
 /// </summary>
    [HttpGet("{statementId:guid}")]
    public async Task<ActionResult<PartyBillingStatementDto>> Get(
        Guid statementId,
        CancellationToken ct)
    {
        var ctx = await BuildActorContextAsync(ct);
        if (ctx.UserId is null) return Unauthorized();

        var statement = await _statements.GetStatementAsync(statementId, ct);
        if (statement is null) return NotFound();

        if (ctx.IsFinancialOfficer || ctx.IsOperationsManager)
            return Ok(statement);

        var isOwner = !string.IsNullOrWhiteSpace(ctx.AssigneeId)
            && string.Equals(ctx.AssigneeId, statement.AssigneeId, StringComparison.Ordinal);
        var issuedOrLater = statement.Status is "issued" or "invoice_received" or "closed";
        return isOwner && issuedOrLater ? Ok(statement) : NotFound();
    }

 /// <summary>
 /// The visibility rule of the statement list. Office: only its own issued-or-later statements
 /// (null when it has no assignee id at all → 403). Supervisor: issued-or-later unless finance
 /// asks otherwise. Finance: whatever it filtered.
 /// </summary>
    private static (string? AssigneeId, bool IssuedOrLaterOnly)? NarrowStatementList(
        ActorContext ctx,
        string? assigneeId,
        bool issuedOrLaterOnly)
    {
        if (!ctx.IsFinancialOfficer && !ctx.IsOperationsManager)
        {
            if (string.IsNullOrWhiteSpace(ctx.AssigneeId))
                return null;
            return (ctx.AssigneeId, true);
        }

        var issuedOnly = issuedOrLaterOnly
            || (ctx.IsOperationsManager && !ctx.IsFinancialOfficer);
        return (assigneeId, issuedOnly);
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
