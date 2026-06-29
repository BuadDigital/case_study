using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Web.Authorization;

namespace RealEstateEval.CaseStudy.Api.Controllers;

[ApiController]
[Route("api/workflow-tasks")]
[Authorize]
public class WorkflowTasksController : ControllerBase
{
    private readonly IWorkflowTaskService _tasks;

    public WorkflowTasksController(IWorkflowTaskService tasks)
    {
        _tasks = tasks;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<WorkflowTaskDto>>> List(
        CancellationToken cancellationToken)
    {
        return Ok(await _tasks.ListAsync(cancellationToken));
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
        return Ok(await _tasks.ConfirmDistributionAsync(id, request, cancellationToken));
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
}
