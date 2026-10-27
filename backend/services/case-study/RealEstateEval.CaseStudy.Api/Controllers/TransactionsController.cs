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
/// The transaction (المعاملة) above the deeds —. Reads the header with its
/// deeds and one timeline for all of them; the case specialist merges transactions, takes a deed
/// back out (before the PR number) and searches deeds to merge. Visibility follows the deeds'
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
    /// <remarks>
    /// How it works: resolves the caller's permissions and passes the target id and request (deed ids, link
    /// kind one_building | contract, reason) to <c>ITransactionCommands.MergeAsync</c>. A rule refusal → 400
    /// with the Arabic message; an unknown transaction → 404; else the refreshed detail.
    /// Edge cases: the rules live in the command service — specialist only, every deed must have finished
    /// intake (BourseDataCompleted), so a merge may come before distribution.
    /// </remarks>
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
    /// <remarks>
    /// How it works: resolves the caller's permissions and passes the transaction id and request (deed,
    /// reason) to <c>ITransactionCommands.UnmergeDeedAsync</c>, which gives the deed a fresh TMP transaction
    /// and its own valuation request back. A rule refusal → 400; an unknown transaction → 404; else the
    /// remaining transaction's detail.
    /// Edge cases: once the PR number exists the command refuses — a deed never leaves after the official number.
    /// </remarks>
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
