using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Web;

namespace RealEstateEval.Financial.Api.Controllers;

[ApiController]
[Route("api/financial-dispatch/party-billing-statements")]
[Authorize]
[RequireUpstreamDispatch]
public sealed class PartyBillingDispatchController(IPartyBillingStatementService statements) : ControllerBase
{
    [HttpGet("ready-lines")]
    public async Task<ActionResult<IReadOnlyList<PartyBillingReadyLineDto>>> ReadyLines(
        [FromQuery] string? assigneeId,
        CancellationToken cancellationToken) =>
        Ok(await statements.ListReadyLinesAsync(assigneeId, cancellationToken));

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<PartyBillingStatementDto>>> List(
        [FromQuery] string? assigneeId,
        [FromQuery] string? status,
        [FromQuery] bool issuedOrLaterOnly = false,
        CancellationToken cancellationToken = default) =>
        Ok(await statements.ListStatementsAsync(assigneeId, status, issuedOrLaterOnly, cancellationToken));

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
