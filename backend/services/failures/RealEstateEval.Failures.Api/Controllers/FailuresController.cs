using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Web;
using RealEstateEval.Shared.Web.Authorization;
namespace RealEstateEval.Failures.Api.Controllers;

[ApiController]
[Route("api/failures")]
[Authorize]
public class FailuresController : ControllerBase
{
    private readonly IFailureService _failures;
    private readonly IPermissionService _permissions;

    public FailuresController(IFailureService failures, IPermissionService permissions)
    {
        _failures = failures;
        _permissions = permissions;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<FailureRecordDto>>> List(
        CancellationToken cancellationToken)
    {
        return Ok(await _failures.ListAsync(await ActorAsync(cancellationToken), cancellationToken));
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
