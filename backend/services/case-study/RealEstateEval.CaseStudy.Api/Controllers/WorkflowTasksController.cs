using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Web;
using RealEstateEval.Shared.Web.Authorization;

namespace RealEstateEval.CaseStudy.Api.Controllers;

[ApiController]
[Route("api/workflow-tasks")]
[Route("api/workflow-tasks/v1")]
[Authorize]
public class WorkflowTasksController : ControllerBase
{
    private readonly IWorkflowTaskService _tasks;
    private readonly IDashboardOpsMetricsQuery _opsMetrics;
    private readonly IPermissionService _permissions;

    public WorkflowTasksController(
        IWorkflowTaskService tasks,
        IDashboardOpsMetricsQuery opsMetrics,
        IPermissionService permissions)
    {
        _tasks = tasks;
        _opsMetrics = opsMetrics;
        _permissions = permissions;
    }

    [HttpGet("ops-metrics")]
    [Authorize(Policy = CapabilityPolicyNames.ReadManagementReports)]
    public async Task<ActionResult<DashboardOpsMetricsDto>> OpsMetrics(
        CancellationToken cancellationToken) =>
        Ok(await _opsMetrics.GetAsync(cancellationToken));

    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] int? page,
        [FromQuery] int? pageSize,
        CancellationToken cancellationToken)
    {
        var actor = await _permissions.GetForUserIdAsync(ActorId(), cancellationToken);
        if (page.HasValue || pageSize.HasValue)
            return Ok(await _tasks.ListPagedAsync(page, pageSize, actor, cancellationToken));

        return Ok(await _tasks.ListAsync(actor, cancellationToken));
    }

    [HttpPost("sync")]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<ActionResult<IReadOnlyList<WorkflowTaskDto>>> Sync(
        CancellationToken cancellationToken)
    {
        return Ok(await _tasks.SyncFromWorkOrdersAsync(cancellationToken));
    }

    [HttpPatch("{id:guid}/distribution")]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<ActionResult<WorkflowTaskDto>> PatchDistribution(
        Guid id,
        [FromBody] PatchWorkflowTaskDistributionRequest request,
        CancellationToken cancellationToken)
    {
        var dto = await _tasks.PatchDistributionAsync(
            id,
            request.Distribution,
            cancellationToken);
        if (dto is null) return NotFound();
        return Ok(dto);
    }

    [HttpPost("{id:guid}/confirm-distribution")]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<ActionResult<ConfirmTaskDistributionResponseDto>> ConfirmDistribution(
        Guid id,
        [FromBody] ConfirmTaskDistributionRequest request,
        CancellationToken cancellationToken)
    {
        var (result, errors) = await _tasks.ConfirmDistributionAsync(
            id,
            request,
            cancellationToken);
        if (errors is not null)
            return this.FieldErrorsProblem(errors);
        return Ok(result);
    }

    [HttpPost("{id:guid}/advance-after-enfath")]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<ActionResult<WorkflowTaskDto>> AdvanceAfterEnfath(
        Guid id,
        [FromBody] AdvanceTaskAfterEnfathRequest request,
        CancellationToken cancellationToken)
    {
        var dto = await _tasks.AdvanceAfterEnfathAsync(id, request, cancellationToken);
        if (dto is null) return NotFound();
        return Ok(dto);
    }

    [HttpPost("{id:guid}/advance-after-bourse")]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<ActionResult<WorkflowTaskDto>> AdvanceAfterBourse(
        Guid id,
        [FromBody] AdvanceTaskAfterBourseRequest request,
        CancellationToken cancellationToken)
    {
        var dto = await _tasks.AdvanceAfterBourseAsync(id, request, cancellationToken);
        if (dto is null) return NotFound();
        return Ok(dto);
    }

    [HttpPost("{id:guid}/revert-phase")]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<ActionResult<WorkflowTaskDto>> RevertPhase(
        Guid id,
        [FromBody] RevertWorkflowTaskPhaseRequest request,
        CancellationToken cancellationToken)
    {
        var (result, errors) = await _tasks.RevertPhaseAsync(id, request, cancellationToken);
        if (errors is not null)
            return this.FieldErrorsProblem(errors);
        if (result is null) return NotFound();
        return Ok(result);
    }

    [HttpPatch("{id:guid}")]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<ActionResult<WorkflowTaskDto>> Patch(
        Guid id,
        [FromBody] PatchWorkflowTaskRequest request,
        CancellationToken cancellationToken)
    {
        var dto = await _tasks.PatchAsync(id, request, cancellationToken);
        if (dto is null) return NotFound();
        return Ok(dto);
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<IActionResult> DeleteSlot(
        Guid id,
        [FromBody] DeleteCaseStudySlotRequest? request,
        CancellationToken cancellationToken)
    {
        var (ok, errors) = await _tasks.DeleteCaseStudySlotAsync(
            id,
            request ?? new DeleteCaseStudySlotRequest(),
            cancellationToken);
        if (!ok && errors is null) return NotFound();
        if (errors is not null) return UnprocessableEntity(errors);
        return NoContent();
    }

    [HttpDelete("by-po/{poNumber}")]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<IActionResult> DeleteForPo(
        string poNumber,
        CancellationToken cancellationToken)
    {
        await _tasks.DeleteForPoAsync(poNumber, cancellationToken);
        return NoContent();
    }

    [HttpDelete("by-po/{poNumber}/properties/{propertyId:guid}")]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<IActionResult> DeleteForProperty(
        string poNumber,
        Guid propertyId,
        [FromQuery] int expectedPropertyCount = 1,
        CancellationToken cancellationToken = default)
    {
        await _tasks.DeleteForPropertyAsync(
            poNumber,
            propertyId,
            expectedPropertyCount,
            cancellationToken);
        return NoContent();
    }

    [HttpPost("{id:guid}/reopen-completed")]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<ActionResult<WorkflowTaskDto>> ReopenCompleted(
        Guid id,
        [FromBody] ReopenCompletedWorkflowTaskRequest request,
        CancellationToken cancellationToken)
    {
        var (result, errors) = await _tasks.ReopenCompletedAsync(
            id,
            request,
            await ActorPrototypeRoleAsync(cancellationToken),
            ActorName(),
            cancellationToken);
        if (errors is not null) return this.FieldErrorsProblem(errors);
        if (result is null) return this.NotFoundProblem("المهمة غير موجودة.");
        return Ok(result);
    }

    [HttpPost("{id:guid}/redistribute")]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
    public async Task<ActionResult<WorkflowTaskDto>> Redistribute(
        Guid id,
        [FromBody] RedistributePartiesRequest request,
        CancellationToken cancellationToken)
    {
        var (result, errors) = await _tasks.RedistributePartiesAsync(
            id,
            request,
            await ActorPrototypeRoleAsync(cancellationToken),
            ActorName(),
            cancellationToken);
        if (errors is not null) return this.FieldErrorsProblem(errors);
        if (result is null) return this.NotFoundProblem("المهمة غير موجودة.");
        return Ok(result);
    }

 /// <summary>JWT carries identity roles (Editor/CDO), not prototype roles. Resolve like PermissionService.</summary>
    private async Task<string> ActorPrototypeRoleAsync(CancellationToken cancellationToken)
    {
        var userId = ActorId();
        if (userId.Length == 0) return "";

        var permissions = await _permissions.GetForUserIdAsync(userId, cancellationToken);
        var resolved = permissions?.PrototypeRole;
        if (!string.IsNullOrWhiteSpace(resolved))
            return resolved;

        return User.FindFirstValue("role")?.Trim()
            ?? User.FindFirstValue(ClaimTypes.Role)?.Trim()
            ?? "";
    }

    private string ActorId() => ActorClaims.Id(User);

 /// <summary>
 /// Never fall back to <see cref="System.Security.Claims.ClaimsIdentity.Name"/> —
 /// NameClaimType is <c>sub</c>, so Identity.Name is the user id GUID.
 /// </summary>
    private string ActorName() => ActorClaims.DisplayName(User);
}
