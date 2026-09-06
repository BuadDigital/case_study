using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application;
using Microsoft.Extensions.Options;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Web;
using RealEstateEval.Shared.Web.Authorization;
using RealEstateEval.Financial.Application.Contracts;
using RealEstateEval.Financial.Application.Abstractions;

namespace RealEstateEval.Financial.Api.Controllers;

[ApiController]
[Route("api/financial")]
[Authorize]
public class FinancialController : ControllerBase
{
    private readonly IFinancialReportService _financial;
    private readonly IPartyFeePricingService _pricing;
    private readonly IIncentiveSuspensionService _incentiveSuspensions;
    private readonly IDiscountFlagService _discountFlags;
    private readonly ILogger<FinancialController> _logger;
    private readonly DatabaseOptions _dbOptions;

    public FinancialController(
        IFinancialReportService financial,
        IPartyFeePricingService pricing,
        IIncentiveSuspensionService incentiveSuspensions,
        IDiscountFlagService discountFlags,
        ILogger<FinancialController> logger,
        IOptions<DatabaseOptions>? dbOptions = null)
    {
        _financial = financial;
        _pricing = pricing;
        _incentiveSuspensions = incentiveSuspensions;
        _discountFlags = discountFlags;
        _logger = logger;
        _dbOptions = dbOptions?.Value ?? new DatabaseOptions();
    }

    [HttpGet("summary")]
    [Authorize(Policy = CapabilityPolicyNames.ManageFinancial)]
    public async Task<ActionResult<FinancialSummaryDto>> Summary(CancellationToken ct)
        => Ok(await _financial.GetSummaryAsync(ct));

    [HttpPut("summary")]
    [Authorize(Policy = CapabilityPolicyNames.ManageFinancial)]
    public async Task<ActionResult<FinancialSummaryDto>> Save(
        [FromBody] FinancialSummaryDto request,
        CancellationToken ct)
        => Ok(await _financial.SaveSummaryAsync(request, ct));

    [HttpGet("party-fee-pricing/tables")]
    public async Task<ActionResult<IReadOnlyList<PartyFeePricingTableSummaryDto>>> ListPartyFeePricingTables(
        [FromQuery] string? category,
        CancellationToken ct)
    {
 // An unknown filter used to be coerced to engineering-survey, so a typo silently returned
 // another category's tables as if they were the ones asked for.
        if (!string.IsNullOrWhiteSpace(category) && !PartyFeePricingCategories.IsValid(category))
            return this.BadRequestProblem(PartyFeePricingCategories.InvalidMessage(category));

        return Ok(await _pricing.ListAsync(category, ct));
    }

    [HttpGet("party-fee-pricing/{id:guid}")]
    public async Task<ActionResult<PartyFeePricingDto>> GetPartyFeePricing(Guid id, CancellationToken ct)
    {
        var row = await _pricing.GetByIdAsync(id, ct);
        return row is null ? NotFound() : Ok(row);
    }

    [HttpPost("party-fee-pricing")]
    [Authorize(Policy = CapabilityPolicyNames.ManagePartyFeePricing)]
    public async Task<ActionResult<PartyFeePricingDto>> CreatePartyFeePricing(
        [FromBody] CreatePartyFeePricingTableRequest request,
        CancellationToken ct)
    {
        if (!PartyFeePricingCategories.IsValid(request.Category))
            return this.BadRequestProblem(PartyFeePricingCategories.InvalidMessage(request.Category));

        try
        {
            return Ok(await _pricing.CreateAsync(request, ct, ActorClaims.Id(User)));
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Rejected create of party fee pricing table");
            return this.BadRequestProblem(ex.Message);
        }
    }

    [HttpPut("party-fee-pricing/{id:guid}")]
    [Authorize(Policy = CapabilityPolicyNames.ManagePartyFeePricing)]
    public async Task<ActionResult<PartyFeePricingDto>> SavePartyFeePricing(
        Guid id,
        [FromBody] PartyFeePricingDto request,
        CancellationToken ct)
    {
        try
        {
            return Ok(await _pricing.SaveAsync(id, request, ct, ActorClaims.Id(User)));
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Rejected save of party fee pricing table {TableId}", id);
            return this.BadRequestProblem(ex.Message);
        }
    }

    [HttpPost("party-fee-pricing/{id:guid}/revision")]
    [Authorize(Policy = CapabilityPolicyNames.ManagePartyFeePricing)]
    public async Task<ActionResult<PartyFeePricingDto>> RevisePartyFeePricing(
        Guid id,
        [FromBody] PartyFeePricingDto request,
        CancellationToken ct)
    {
        try
        {
            return Ok(await _pricing.ReviseAsync(id, request, ct, ActorClaims.Id(User)));
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Rejected revision of party fee pricing table {TableId}", id);
            return this.BadRequestProblem(ex.Message);
        }
    }

    [HttpPost("party-fee-pricing/{id:guid}/activate")]
    [Authorize(Policy = CapabilityPolicyNames.ManagePartyFeePricing)]
    public async Task<ActionResult<PartyFeePricingDto>> ActivatePartyFeePricing(
        Guid id,
        CancellationToken ct)
    {
        try
        {
            return Ok(await _pricing.ActivateAsync(id, ct, ActorClaims.Id(User)));
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
        catch (InvalidOperationException ex)
        {
            return this.BadRequestProblem(ex.Message);
        }
    }

    [HttpPut("party-fee-pricing/{id:guid}/assignments")]
    [Authorize(Policy = CapabilityPolicyNames.ManagePartyFeePricing)]
    public async Task<ActionResult<PartyFeePricingDto>> SetPartyFeePricingAssignments(
        Guid id,
        [FromBody] SetPartyFeePricingAssignmentsRequest request,
        CancellationToken ct)
    {
        try
        {
            return Ok(await _pricing.SetAssignmentsAsync(
                id,
                request.AssigneeIds ?? [],
                ct,
                ActorClaims.Id(User)));
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    [HttpDelete("party-fee-pricing/{id:guid}")]
    [Authorize(Policy = CapabilityPolicyNames.ManagePartyFeePricing)]
    public async Task<IActionResult> DeletePartyFeePricing(Guid id, CancellationToken ct)
    {
        try
        {
            var deleted = await _pricing.DeleteAsync(id, ct, ActorClaims.Id(User));
            return deleted ? NoContent() : NotFound();
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Rejected delete of party fee pricing table {TableId}", id);
            return this.BadRequestProblem(
                "تعذر حذف جدول الأتعاب — يجب ألا يكون مرتبطاً بأطراف، ويجب أن يبقى جدول واحد على الأقل في التصنيف.");
        }
    }

 /// <summary>
 /// Incentive-suspension ledger. Sending page or pageSize returns PagedResultDto; without them
 /// the response stays the plain array. See docs/architecture/pagination-contract.md §7.
 /// </summary>
    [HttpGet("incentive-suspensions")]
    [Authorize(Policy = CapabilityPolicyNames.ManageOperations)]
    public async Task<IActionResult> ListIncentiveSuspensions(
        [FromQuery] string? transactionKey,
        [FromQuery] string? assigneeId,
        [FromQuery] int? page = null,
        [FromQuery] int? pageSize = null,
        [FromQuery] string? sort = null,
        [FromQuery] string? dir = null,
        [FromQuery] string? q = null,
        [FromQuery] bool activeOnly = true,
        CancellationToken ct = default)
    {
        var query = new IncentiveSuspensionListQuery
        {
            Page = page,
            PageSize = pageSize,
            Sort = sort,
            Dir = dir,
            Q = q,
            TransactionKey = transactionKey,
            AssigneeId = assigneeId,
            ActiveOnly = activeOnly,
        };

        if (!query.IsPaged)
            return Ok(await _incentiveSuspensions.ListAsync(query, ct));

        var (skip, take, resolvedPage, _) = NpgsqlConfiguration.ResolveListPaging(
            query.Page, query.PageSize, _dbOptions);
        return Ok(await _incentiveSuspensions.ListPagedAsync(query, skip, take, resolvedPage, ct));
    }

    [HttpPost("incentive-suspensions")]
    [Authorize(Policy = CapabilityPolicyNames.ManageOperations)]
    public async Task<ActionResult<IncentiveSuspensionDto>> CreateIncentiveSuspension(
        [FromBody] CreateIncentiveSuspensionRequest request,
        CancellationToken ct)
    {
        var (row, error) = await _incentiveSuspensions.CreateAsync(
            request,
            ActorClaims.Id(User),
            ct);
        return error is not null
            ? this.BadRequestProblem(error)
            : Ok(row);
    }

    [HttpPost("incentive-suspensions/{id:guid}/lift")]
    [Authorize(Policy = CapabilityPolicyNames.ManageOperations)]
    public async Task<ActionResult<IncentiveSuspensionDto>> LiftIncentiveSuspension(
        Guid id,
        CancellationToken ct)
    {
        var (row, error) = await _incentiveSuspensions.LiftAsync(id, ActorClaims.Id(User), ct);
        if (error is not null && row is null && error.Contains("غير موجود", StringComparison.Ordinal))
            return NotFound();
        return error is not null
            ? this.BadRequestProblem(error)
            : Ok(row);
    }

 /// <summary>
 /// Discount-flag ledger. Sending page or pageSize returns PagedResultDto; without them the
 /// response stays the plain array. See docs/architecture/pagination-contract.md §7.
 /// </summary>
    [HttpGet("discount-flags")]
    [Authorize(Policy = CapabilityPolicyNames.ManageOperations)]
    public async Task<IActionResult> ListDiscountFlags(
        [FromQuery] string? transactionKey,
        [FromQuery] string? status,
        [FromQuery] int? page = null,
        [FromQuery] int? pageSize = null,
        [FromQuery] string? sort = null,
        [FromQuery] string? dir = null,
        [FromQuery] string? q = null,
        CancellationToken ct = default)
    {
        var query = new DiscountFlagListQuery
        {
            Page = page,
            PageSize = pageSize,
            Sort = sort,
            Dir = dir,
            Q = q,
            TransactionKey = transactionKey,
            Status = status,
        };

        if (!query.IsPaged)
            return Ok(await _discountFlags.ListAsync(query, ct));

        var (skip, take, resolvedPage, _) = NpgsqlConfiguration.ResolveListPaging(
            query.Page, query.PageSize, _dbOptions);
        return Ok(await _discountFlags.ListPagedAsync(query, skip, take, resolvedPage, ct));
    }

    [HttpPost("discount-flags")]
    [Authorize(Policy = CapabilityPolicyNames.ManageOperations)]
    public async Task<ActionResult<DiscountFlagDto>> CreateDiscountFlag(
        [FromBody] CreateDiscountFlagRequest request,
        CancellationToken ct)
    {
        var (row, error) = await _discountFlags.CreateAsync(request, ActorClaims.Id(User), ct);
        return error is not null ? this.BadRequestProblem(error) : Ok(row);
    }

    [HttpPost("discount-flags/{id:guid}/approve")]
    [Authorize(Policy = CapabilityPolicyNames.ManageOperations)]
    public async Task<ActionResult<DiscountFlagDto>> ApproveDiscountFlag(
        Guid id,
        [FromBody] ResolveDiscountFlagRequest? request,
        CancellationToken ct)
    {
 // ManageOperations holders act across departments on the financial host; department
 // scoping is enforced in Case Study supervisor queues via InspectorFeesController.
        var (row, error) = await _discountFlags.ApproveAsync(
            id,
            request ?? new ResolveDiscountFlagRequest(),
            ActorClaims.Id(User),
            actorDepartment: null,
            canManageAllDepartments: true,
            ct);
        if (error is not null && error.Contains("غير موجود", StringComparison.Ordinal))
            return NotFound();
        return error is not null ? this.BadRequestProblem(error) : Ok(row);
    }

    [HttpPost("discount-flags/{id:guid}/reject")]
    [Authorize(Policy = CapabilityPolicyNames.ManageOperations)]
    public async Task<ActionResult<DiscountFlagDto>> RejectDiscountFlag(
        Guid id,
        [FromBody] ResolveDiscountFlagRequest? request,
        CancellationToken ct)
    {
        var (row, error) = await _discountFlags.RejectAsync(
            id,
            request ?? new ResolveDiscountFlagRequest(),
            ActorClaims.Id(User),
            actorDepartment: null,
            canManageAllDepartments: true,
            ct);
        if (error is not null && error.Contains("غير موجود", StringComparison.Ordinal))
            return NotFound();
        return error is not null ? this.BadRequestProblem(error) : Ok(row);
    }
}
