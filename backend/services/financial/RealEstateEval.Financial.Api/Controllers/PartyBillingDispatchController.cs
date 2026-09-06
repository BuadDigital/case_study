using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Shared.Web;

namespace RealEstateEval.Financial.Api.Controllers;

[ApiController]
[Route("api/financial-dispatch/party-billing-statements")]
[Authorize]
[RequireUpstreamDispatch]
public sealed class PartyBillingDispatchController(
    IPartyBillingStatementService statements,
    IOptions<DatabaseOptions>? dbOptions = null) : ControllerBase
{
    private readonly DatabaseOptions _dbOptions = dbOptions?.Value ?? new DatabaseOptions();

    /// <summary>
    /// Same envelope rule as the public route on the Case Study host: page or pageSize present
    /// returns <see cref="PagedResultDto{T}"/>, otherwise the plain array. The page window is
    /// resolved here from the owner's options. See docs/architecture/pagination-contract.md §9.2.
    /// </summary>
    [HttpGet("ready-lines")]
    public async Task<IActionResult> ReadyLines(
        [FromQuery] string? assigneeId,
        [FromQuery] int? page = null,
        [FromQuery] int? pageSize = null,
        [FromQuery] string? sort = null,
        [FromQuery] string? dir = null,
        [FromQuery] string? q = null,
        CancellationToken cancellationToken = default)
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
            return Ok(await statements.ListReadyLinesAsync(query, cancellationToken));

        var (skip, take, resolvedPage, _) = NpgsqlConfiguration.ResolveListPaging(
            query.Page, query.PageSize, _dbOptions);
        return Ok(await statements.ListReadyLinesPagedAsync(
            query, skip, take, resolvedPage, cancellationToken));
    }

    /// <summary>
    /// Mirrors <c>GET /api/party-billing-statements</c> exactly — the "dispatch envelope" gap of
    /// pagination-contract §9.1: paged in, paged out. Actor narrowing already happened on the
    /// calling host; this route trusts the forwarded <c>assigneeId</c> / <c>issuedOrLaterOnly</c>.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] string? assigneeId,
        [FromQuery] string? status,
        [FromQuery] bool issuedOrLaterOnly = false,
        [FromQuery] int? page = null,
        [FromQuery] int? pageSize = null,
        [FromQuery] string? sort = null,
        [FromQuery] string? dir = null,
        [FromQuery] string? q = null,
        CancellationToken cancellationToken = default)
    {
        var query = new PartyBillingStatementListQuery
        {
            Page = page,
            PageSize = pageSize,
            Sort = sort,
            Dir = dir,
            Q = q,
            AssigneeId = assigneeId,
            Status = status,
            IssuedOrLaterOnly = issuedOrLaterOnly,
        };

        if (!query.IsPaged)
            return Ok(await statements.ListStatementsAsync(query, cancellationToken));

        var (skip, take, resolvedPage, _) = NpgsqlConfiguration.ResolveListPaging(
            query.Page, query.PageSize, _dbOptions);
        return Ok(await statements.ListStatementsPagedAsync(
            query, skip, take, resolvedPage, cancellationToken));
    }

    [HttpGet("{statementId:guid}")]
    public async Task<ActionResult<PartyBillingStatementDto>> Get(
        Guid statementId,
        CancellationToken cancellationToken)
    {
        var row = await statements.GetStatementAsync(statementId, cancellationToken);
        return row is null ? NotFound() : Ok(row);
    }

    [HttpPost]
    public async Task<ActionResult<CreatePartyBillingStatementResponseDto>> Create(
        [FromBody] PartyBillingCreateDispatchRequest request,
        CancellationToken cancellationToken) =>
        Ok(await statements.CreateStatementAsync(request.Request, request.ActorUserId, cancellationToken));

    [HttpPost("month-vendor")]
    public async Task<ActionResult<CreateMonthPartyBillingStatementsResponseDto>> MonthVendor(
        [FromBody] ActorUserRequest request,
        CancellationToken cancellationToken) =>
        Ok(await statements.CreateMonthVendorStatementsAsync(request.ActorUserId, cancellationToken));

    [HttpPost("{statementId:guid}/issue")]
    public async Task<ActionResult<PartyBillingStatementDto>> Issue(
        Guid statementId,
        [FromBody] ActorUserRequest request,
        CancellationToken cancellationToken)
    {
        var (row, error) = await statements.IssueStatementAsync(
            statementId, request.ActorUserId, cancellationToken);
        return error is not null ? this.BadRequestProblem(error) : row is null ? NotFound() : Ok(row);
    }

    [HttpPost("{statementId:guid}/vendor-invoice")]
    public async Task<ActionResult<PartyBillingStatementDto>> SubmitVendorInvoice(
        Guid statementId,
        [FromBody] PartyBillingVendorInvoiceDispatchRequest request,
        CancellationToken cancellationToken)
    {
        var (row, error) = await statements.SubmitVendorInvoiceAsync(
            statementId, request.Request, request.ActorUserId, cancellationToken);
        return error is not null ? this.BadRequestProblem(error) : row is null ? NotFound() : Ok(row);
    }

    [HttpPost("{statementId:guid}/match-vendor-invoice")]
    public async Task<ActionResult<PartyBillingStatementDto>> MatchVendorInvoice(
        Guid statementId,
        [FromBody] ActorUserRequest request,
        CancellationToken cancellationToken)
    {
        var (row, error) = await statements.MatchVendorInvoiceAsync(
            statementId, request.ActorUserId, cancellationToken);
        return error is not null ? this.BadRequestProblem(error) : row is null ? NotFound() : Ok(row);
    }

    [HttpPost("{statementId:guid}/reject-vendor-invoice")]
    public async Task<ActionResult<PartyBillingStatementDto>> RejectVendorInvoice(
        Guid statementId,
        [FromBody] PartyBillingRejectInvoiceDispatchRequest request,
        CancellationToken cancellationToken)
    {
        var (row, error) = await statements.RejectVendorInvoiceAsync(
            statementId, request.Request, request.ActorUserId, cancellationToken);
        return error is not null ? this.BadRequestProblem(error) : row is null ? NotFound() : Ok(row);
    }

    [HttpPost("{statementId:guid}/close")]
    public async Task<ActionResult<PartyBillingStatementDto>> Close(
        Guid statementId,
        [FromBody] PartyBillingCloseDispatchRequest request,
        CancellationToken cancellationToken)
    {
        var (row, error) = await statements.CloseStatementAsync(
            statementId, request.Request, request.ActorUserId, cancellationToken);
        return error is not null ? this.BadRequestProblem(error) : row is null ? NotFound() : Ok(row);
    }

    [HttpPost("{statementId:guid}/cancel")]
    public async Task<ActionResult<PartyBillingStatementDto>> Cancel(
        Guid statementId,
        [FromBody] PartyBillingCancelDispatchRequest request,
        CancellationToken cancellationToken)
    {
        var (row, error) = await statements.CancelStatementAsync(
            statementId, request.Request, request.ActorUserId, cancellationToken);
        return error is not null ? this.BadRequestProblem(error) : row is null ? NotFound() : Ok(row);
    }

    [HttpPost("defer-lines")]
    public async Task<ActionResult<DeferPartyBillingLinesResponseDto>> DeferLines(
        [FromBody] PartyBillingDeferDispatchRequest request,
        CancellationToken cancellationToken) =>
        Ok(await statements.DeferLinesAsync(request.Request, request.ActorUserId, cancellationToken));
}
