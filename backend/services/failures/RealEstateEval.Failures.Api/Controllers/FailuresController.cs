using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Web;
using RealEstateEval.Shared.Web.Authorization;
using RealEstateEval.Failures.Application.Contracts;
using RealEstateEval.Failures.Application.Abstractions;
namespace RealEstateEval.Failures.Api.Controllers;

[ApiController]
[Route("api/failures")]
[Authorize]
public class FailuresController : ControllerBase
{
    private readonly IFailureService _failures;
    private readonly IPermissionService _permissions;
    private readonly DatabaseOptions _dbOptions;

    public FailuresController(
        IFailureService failures,
        IPermissionService permissions,
        IOptions<DatabaseOptions>? dbOptions = null)
    {
        _failures = failures;
        _permissions = permissions;
        _dbOptions = dbOptions?.Value ?? new DatabaseOptions();
    }

 /// <summary>
 /// Failures queue. Sending page or pageSize returns PagedResultDto; without them the response
 /// stays the plain array every existing caller expects.
 /// See docs/architecture/pagination-contract.md §5.
 /// </summary>
    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] int? page,
        [FromQuery] int? pageSize,
        [FromQuery] string? sort,
        [FromQuery] string? dir,
        [FromQuery] string? q,
        [FromQuery] string? status,
        [FromQuery] string? poNumber,
        [FromQuery] string? problemTypeId,
        CancellationToken cancellationToken)
    {
        var actor = await ActorAsync(cancellationToken);
        var query = new FailureListQuery
        {
            Page = page,
            PageSize = pageSize,
            Sort = sort,
            Dir = dir,
            Q = q,
            Status = status,
            PoNumber = poNumber,
            ProblemTypeId = problemTypeId,
        };

        if (!query.IsPaged)
            return Ok(await _failures.ListAsync(query, actor, cancellationToken));

        var (skip, take, resolvedPage, _) = NpgsqlConfiguration.ResolveListPaging(
            query.Page,
            query.PageSize,
            _dbOptions);
        return Ok(await _failures.ListPagedAsync(
            query, actor, skip, take, resolvedPage, cancellationToken));
    }

    [HttpGet("property")]
    public async Task<ActionResult<FailureRecordDto>> GetForProperty(
        [FromQuery] string poNumber,
        [FromQuery] string propertyId,
        CancellationToken cancellationToken)
    {
        var dto = await _failures.GetActiveForPropertyAsync(
            poNumber,
            propertyId,
            await ActorAsync(cancellationToken),
            cancellationToken);
        return this.OkOrEmpty(dto);
    }

    [HttpPost]
    [Authorize(Policy = CapabilityPolicyNames.RaiseFailures)]
    public async Task<ActionResult<FailureRecordDto>> Create(
        [FromBody] CreateFailureRequest request,
        CancellationToken cancellationToken)
    {
        var (result, errors) = await _failures.CreateAsync(request, cancellationToken);
        if (errors is not null) return this.FieldErrorsProblem(errors);
        return Ok(result);
    }

    [HttpPost("bourse-obstruction")]
    [Authorize(Policy = CapabilityPolicyNames.ManageFailures)]
    public async Task<ActionResult<FailureRecordDto>> ReportBourseObstruction(
        [FromBody] BourseObstructionRequest request,
        CancellationToken cancellationToken)
    {
        var (result, errors) = await _failures.ReportBourseObstructionAsync(request, cancellationToken);
        if (errors is not null) return this.FieldErrorsProblem(errors);
        return Ok(result);
    }

    [HttpPost("{id:guid}/upgrade")]
    [Authorize(Policy = CapabilityPolicyNames.ManageFailures)]
    public async Task<ActionResult<FailureRecordDto>> Upgrade(
        Guid id,
        CancellationToken cancellationToken)
    {
        var dto = await _failures.UpgradeToInternalAsync(id, cancellationToken);
        if (dto is null) return this.BadRequestProblem("لا يمكن ترقية هذا التعذر");
        return Ok(dto);
    }

    [HttpPost("{id:guid}/submit")]
    [Authorize(Policy = CapabilityPolicyNames.ManageFailures)]
    public async Task<ActionResult<FailureRecordDto>> Submit(
        Guid id,
        CancellationToken cancellationToken)
    {
        var dto = await _failures.SubmitForReviewAsync(id, cancellationToken);
        if (dto is null) return this.BadRequestProblem("لا يمكن إرسال هذا التعذر للمراجعة");
        return Ok(dto);
    }

    [HttpPost("{id:guid}/suspend")]
    [Authorize(Policy = CapabilityPolicyNames.ManageFailures)]
    public async Task<ActionResult<FailureRecordDto>> Suspend(
        Guid id,
        [FromBody] FailureNoteRequest request,
        CancellationToken cancellationToken)
    {
        var dto = await _failures.SuspendAsync(id, request.Note, ActorClaims.Id(User), cancellationToken);
        if (dto is null) return this.BadRequestProblem("لا يمكن تعليق هذا التعذر");
        return Ok(dto);
    }

    [HttpPost("{id:guid}/resolve")]
    [Authorize(Policy = CapabilityPolicyNames.ManageFailures)]
    public async Task<ActionResult<FailureRecordDto>> Resolve(
        Guid id,
        [FromBody] ResolveFailureRequest request,
        CancellationToken cancellationToken)
    {
        var dto = await _failures.ResolveAsync(id, request, cancellationToken);
        if (dto is null) return this.BadRequestProblem("لا يمكن حل هذا التعذر");
        return Ok(dto);
    }

    [HttpPost("{id:guid}/approve")]
    [Authorize(Policy = CapabilityPolicyNames.ManageFailures)]
    public async Task<ActionResult<FailureRecordDto>> Approve(
        Guid id,
        [FromBody] FailureNoteRequest request,
        CancellationToken cancellationToken)
    {
        var dto = await _failures.ApproveAsync(id, request.Note, cancellationToken);
        if (dto is null) return this.BadRequestProblem("لا يمكن اعتماد هذا التعذر");
        return Ok(dto);
    }

    [HttpPost("{id:guid}/return")]
    [Authorize(Policy = CapabilityPolicyNames.ManageFailures)]
    public async Task<ActionResult<FailureRecordDto>> Return(
        Guid id,
        [FromBody] FailureNoteRequest request,
        CancellationToken cancellationToken)
    {
        var dto = await _failures.ReturnAsync(id, request.Note, cancellationToken);
        if (dto is null) return this.BadRequestProblem("لا يمكن إعادة هذا التعذر");
        return Ok(dto);
    }

    [HttpDelete("by-po/{poNumber}")]
    [Authorize(Policy = CapabilityPolicyNames.ManageFailures)]
    public async Task<IActionResult> DeleteForPo(
        string poNumber,
        CancellationToken cancellationToken)
    {
        await _failures.DeleteForPoAsync(poNumber, cancellationToken);
        return NoContent();
    }

    private async Task<PermissionsDto?> ActorAsync(CancellationToken cancellationToken)
    {
        var userId = ActorClaims.Id(User);
        if (string.IsNullOrWhiteSpace(userId) || userId == "unknown")
            return null;
        return await _permissions.GetForUserIdAsync(userId, cancellationToken);
    }
}
