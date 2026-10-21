using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Web;
using RealEstateEval.Shared.Web.Authorization;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Application.Contracts;

namespace RealEstateEval.CaseStudy.Api.Controllers;

/// <summary>
/// The transaction (المعاملة) above the deeds — decision 2026-10-19. Reads only in this phase:
/// the header with its deeds and one timeline for all of them. Visibility follows the deeds'
/// work orders, as every other property read does.
/// </summary>
[ApiController]
[Route("api/transactions")]
[Authorize(Policy = CapabilityPolicyNames.ReadCaseStudyWorkspace)]
public class TransactionsController : ControllerBase
{
    private readonly ITransactionQuery _transactions;
    private readonly ITransactionCommands _commands;
    private readonly IPermissionService _permissions;

    public TransactionsController(
        ITransactionQuery transactions,
        ITransactionCommands commands,
        IPermissionService permissions)
    {
        _transactions = transactions;
        _commands = commands;
        _permissions = permissions;
    }

    /// <summary>Deeds for the merge dialog, by deed / registry / PO number; each says whether it can join.</summary>
    [HttpGet("{transactionId:guid}/deed-search")]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<ActionResult<IReadOnlyList<TransactionDeedSearchHitDto>>> SearchDeeds(
        Guid transactionId,
        [FromQuery] string? q,
        CancellationToken ct) =>
        Ok(await _commands.SearchDeedsAsync(transactionId, q ?? "", await ActorAsync(ct), ct));

    /// <summary>Merge other deeds' transactions into this one (case-study specialist, audited).</summary>
    [HttpPost("{transactionId:guid}/merge")]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<ActionResult<TransactionDetailDto>> Merge(
        Guid transactionId,
        [FromBody] MergeTransactionsRequest request,
        CancellationToken ct)
    {
        var (result, error) = await _commands.MergeAsync(transactionId, request, await ActorAsync(ct), ct);
        if (error is not null) return this.BadRequestProblem(error);
        return result is null ? NotFound() : Ok(result);
    }

    /// <summary>Take one deed out into a new draft transaction — only before the official reference exists.</summary>
    [HttpPost("{transactionId:guid}/unmerge-deed")]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<ActionResult<TransactionDetailDto>> UnmergeDeed(
        Guid transactionId,
        [FromBody] UnmergeTransactionDeedRequest request,
        CancellationToken ct)
    {
        var (result, error) = await _commands.UnmergeDeedAsync(transactionId, request, await ActorAsync(ct), ct);
        if (error is not null) return this.BadRequestProblem(error);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpGet("by-property/{propertyId:guid}")]
    public async Task<ActionResult<TransactionDetailDto>> GetByProperty(Guid propertyId, CancellationToken ct)
    {
        var dto = await _transactions.GetByPropertyAsync(propertyId, await ActorAsync(ct), ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpGet("{transactionId:guid}")]
    public async Task<ActionResult<TransactionDetailDto>> Get(Guid transactionId, CancellationToken ct)
    {
        var dto = await _transactions.GetAsync(transactionId, await ActorAsync(ct), ct);
        return dto is null ? NotFound() : Ok(dto);
    }

    [HttpGet("{transactionId:guid}/timeline")]
    public async Task<ActionResult<IReadOnlyList<PropertyTimelineEventDto>>> GetTimeline(Guid transactionId, CancellationToken ct)
    {
        var events = await _transactions.GetTimelineAsync(transactionId, await ActorAsync(ct), ct);
        return events is null ? NotFound() : Ok(events);
    }

    private async Task<PermissionsDto?> ActorAsync(CancellationToken cancellationToken)
    {
        var userId = ActorClaims.Id(User);
        if (string.IsNullOrWhiteSpace(userId) || userId == "unknown")
            return null;
        return await _permissions.GetForUserIdAsync(userId, cancellationToken);
    }
}
