using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Shared.Web;

namespace RealEstateEval.Financial.Api.Controllers;

/// <summary>
/// Authenticated inspector-fee commands used by Case Study. Operator capability checks stay
/// on Case Study; these routes are [Authorize] only.
/// </summary>
[ApiController]
[Route("api/financial-dispatch/inspector-fees")]
[Authorize]
public sealed class InspectorFeeDispatchController(
    IInspectorFeeService fees,
    ICaseStudyLookup lookup) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<InspectorFeesSummaryDto>> Summary(
        [FromQuery] string? assigneeId,
        [FromQuery] string? workflowTaskId,
        [FromQuery] bool submittedOnly = true,
        [FromQuery] string? taskKind = null,
        [FromQuery] string? billingStatus = null,
        [FromQuery] string? returnTo = null,
        [FromQuery] bool hideDisputed = false,
        [FromQuery] string? supervisingDepartment = null,
        CancellationToken cancellationToken = default) =>
        Ok(await fees.GetSummaryAsync(
            assigneeId,
            workflowTaskId,
            submittedOnly,
            taskKind,
            billingStatus,
            returnTo,
            hideDisputed,
            cancellationToken,
            supervisingDepartment));

    [HttpGet("{workflowTaskId:guid}")]
    public async Task<ActionResult<InspectorFeeRowDto>> Get(
        Guid workflowTaskId,
        CancellationToken cancellationToken)
    {
        var row = await fees.GetByWorkflowTaskIdAsync(workflowTaskId, cancellationToken);
        return row is null ? NotFound() : Ok(row);
    }

    [HttpGet("{workflowTaskId:guid}/transitions")]
    public async Task<ActionResult<IReadOnlyList<InspectorFeeAuditEntryDto>>> Transitions(
        Guid workflowTaskId,
        CancellationToken cancellationToken) =>
        Ok(await fees.ListTransitionsAsync(workflowTaskId, cancellationToken));

    [HttpPost("ensure-ledgers")]
    public async Task<IActionResult> EnsureLedgers(
        [FromBody] GuidListRequest request,
        CancellationToken cancellationToken)
    {
        var ids = request.Ids.Distinct().ToList();
        if (ids.Count == 0)
            return NoContent();

        var snapshots = await lookup.ListWorkflowTasksByIdsAsync(ids, cancellationToken);
        var tasks = snapshots.Select(s => s.ToWorkflowTask()).ToList();
        await fees.EnsureLedgersForTasksAsync(tasks, cancellationToken);
        return NoContent();
    }

    [HttpPost("ensure-ledgers-for-property/{propertyId:guid}")]
    public async Task<IActionResult> EnsureForProperty(
        Guid propertyId,
        CancellationToken cancellationToken)
    {
        await fees.EnsureLedgersForPropertyAsync(propertyId, cancellationToken);
        return NoContent();
    }

    [HttpPost("{workflowTaskId:guid}/accrue-survey")]
    public async Task<ActionResult<InspectorFeeRowDto>> AccrueSurvey(
        Guid workflowTaskId,
        [FromBody] AccrueEngineeringSurveyFeeDispatchRequest request,
        CancellationToken cancellationToken)
    {
        var (row, error) = await fees.AccrueEngineeringSurveyFeeAsync(
            workflowTaskId, request.ActorUserId, cancellationToken);
        if (error is not null)
            return this.BadRequestProblem(error);
        return row is null ? NotFound() : Ok(row);
    }

    [HttpPost("{workflowTaskId:guid}/patch")]
    public async Task<ActionResult<InspectorFeeRowDto>> Patch(
        Guid workflowTaskId,
        [FromBody] InspectorFeePatchDispatchRequest request,
        CancellationToken cancellationToken)
    {
        var row = await fees.PatchAsync(
            workflowTaskId,
            request.Patch,
            cancellationToken,
            request.ActorDepartment,
            request.CanManageAllDepartments);
        return row is null
            ? this.BadRequestProblem("تعذر حفظ الأتعاب — تحقق من الحالة والحسم والاستبعاد.")
            : Ok(row);
    }

    [HttpPost("{workflowTaskId:guid}/transition")]
    public async Task<ActionResult<InspectorFeeRowDto>> Transition(
        Guid workflowTaskId,
        [FromBody] InspectorFeeTransitionDispatchRequest request,
        CancellationToken cancellationToken)
    {
        var (row, error) = await fees.TransitionAsync(
            workflowTaskId,
            request.Transition,
            request.ActorUserId,
            request.ActorAssigneeId,
            request.IsOperationsManager,
            request.IsFinancialOfficer,
            cancellationToken,
            request.ActorDepartment,
            request.CanManageAllDepartments);
        if (error is not null)
            return this.BadRequestProblem(error);
        return row is null ? NotFound() : Ok(row);
    }

    [HttpPost("batch-transition")]
    public async Task<ActionResult<BatchInspectorFeeTransitionResponseDto>> BatchTransition(
        [FromBody] InspectorFeeBatchTransitionDispatchRequest request,
        CancellationToken cancellationToken) =>
        Ok(await fees.BatchTransitionAsync(
            request.Batch,
            request.ActorUserId,
            request.ActorAssigneeId,
            request.IsOperationsManager,
            request.IsFinancialOfficer,
            cancellationToken,
            request.ActorDepartment,
            request.CanManageAllDepartments));

    [HttpPost("disbursement-batch")]
    public async Task<ActionResult<CreateDisbursementBatchResponseDto>> DisbursementBatch(
        [FromBody] InspectorFeeDisbursementDispatchRequest request,
        CancellationToken cancellationToken) =>
        Ok(await fees.CreateDisbursementBatchAsync(
            request.Request,
            request.ActorUserId,
            request.ActorAssigneeId,
            cancellationToken));

    [HttpPost("delete-for-tasks")]
    public async Task<IActionResult> DeleteForTasks(
        [FromBody] GuidListRequest request,
        CancellationToken cancellationToken)
    {
        await fees.DeleteForWorkflowTaskIdsAsync(request.Ids, cancellationToken);
        return NoContent();
    }
}
