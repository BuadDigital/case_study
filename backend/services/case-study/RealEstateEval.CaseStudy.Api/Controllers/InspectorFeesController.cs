using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Authorization;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Shared.Web;
using RealEstateEval.Shared.Web.Authorization;

namespace RealEstateEval.CaseStudy.Api.Controllers;

[ApiController]
[Route("api/inspector-fees")]
[Authorize]
public class InspectorFeesController : ControllerBase
{
    private readonly IInspectorFeeService _fees;
    private readonly IWorkflowTaskService _workflowTasks;
    private readonly IPermissionService _permissions;

    public InspectorFeesController(
        IInspectorFeeService fees,
        IWorkflowTaskService workflowTasks,
        IPermissionService permissions)
    {
        _fees = fees;
        _workflowTasks = workflowTasks;
        _permissions = permissions;
    }

    [HttpGet]
    public async Task<ActionResult<InspectorFeesSummaryDto>> List(
        [FromQuery] string? assigneeId,
        [FromQuery] string? workflowTaskId,
        [FromQuery] bool submittedOnly = true,
        [FromQuery] string? taskKind = null,
        [FromQuery] string? billingStatus = null,
        [FromQuery] string? returnTo = null,
        CancellationToken ct = default)
    {
        var ctx = await BuildActorContextAsync(ct);
        if (!ctx.IsOperationsManager && !ctx.IsFinancialOfficer)
        {
            if (string.IsNullOrWhiteSpace(ctx.AssigneeId))
                return Forbid();
            assigneeId = ctx.AssigneeId;
        }

        return Ok(await _fees.GetSummaryAsync(
            assigneeId,
            workflowTaskId,
            submittedOnly,
            taskKind,
            billingStatus,
            returnTo,
            hideDisputed: ctx.IsFinanceOnly,
            cancellationToken: ct,
            supervisingDepartment: ctx.VisibleDepartment));
    }

    [HttpGet("{workflowTaskId:guid}/transitions")]
    public async Task<ActionResult<IReadOnlyList<InspectorFeeAuditEntryDto>>> ListTransitions(
        Guid workflowTaskId,
        CancellationToken ct)
    {
        var ctx = await BuildActorContextAsync(ct);
        if (!ctx.IsOperationsManager && !ctx.IsFinancialOfficer)
        {
            if (string.IsNullOrWhiteSpace(ctx.AssigneeId))
                return Forbid();

            var ownsTask = await _workflowTasks.IsAssignedToAsync(
                workflowTaskId,
                ctx.AssigneeId,
                ct);
            if (!ownsTask)
                return NotFound();
        }

        if (ctx.IsFinanceOnly)
        {
            // The list already hides disputed rows from finance; the history must hide with it,
            // otherwise the amount under dispute leaks through the audit entries.
            var row = await _fees.GetByWorkflowTaskIdAsync(workflowTaskId, ct);
            if (row is not null
                && row.BillingStatus == InspectorFeeBillingStatus.Disputed)
            {
                return NotFound();
            }
        }

        return Ok(await _fees.ListTransitionsAsync(workflowTaskId, ct));
    }

    [HttpPatch("{workflowTaskId:guid}")]
    [Authorize(Policy = CapabilityPolicyNames.ManageOperations)]
    public async Task<ActionResult<InspectorFeeRowDto>> Patch(
        Guid workflowTaskId,
        [FromBody] PatchInspectorFeeRequest request,
        CancellationToken ct)
    {
        var ctx = await BuildActorContextAsync(ct);
        if (ctx.UserId is null) return Unauthorized();
        if (!ctx.CanSuperviseAnyDepartment) return Forbid();
        var existing = await _fees.GetByWorkflowTaskIdAsync(workflowTaskId, ct);
        if (existing is null) return NotFound();
        if (!ctx.CanManage(existing.SupervisingDepartment)) return Forbid();

        var row = await _fees.PatchAsync(
            workflowTaskId,
            request,
            ct,
            ctx.Department,
            ctx.CanManageAllDepartments);
        return row is null
            ? BadRequest(new { error = "تعذر حفظ الأتعاب — تحقق من الحالة والحسم والاستبعاد." })
            : Ok(row);
    }

    [HttpPost("{workflowTaskId:guid}/transition")]
    public async Task<ActionResult<InspectorFeeRowDto>> Transition(
        Guid workflowTaskId,
        [FromBody] InspectorFeeTransitionRequest request,
        CancellationToken ct)
    {
        var action = request.Action.Trim().ToLowerInvariant();
        var ctx = await BuildActorContextAsync(ct);
        if (ctx.UserId is null) return Unauthorized();
        if (!IsAuthorizedForAction(action, ctx))
            return Forbid();

        var (row, error) = await _fees.TransitionAsync(
            workflowTaskId,
            request,
            ctx.UserId,
            ctx.AssigneeId,
            ctx.IsOperationsManager,
            ctx.IsFinancialOfficer,
            ct,
            ctx.Department,
            ctx.CanManageAllDepartments);
        if (error is not null)
            return BadRequest(new { error });
        return row is null ? NotFound() : Ok(row);
    }

    [HttpPost("batch-transition")]
    public async Task<ActionResult<BatchInspectorFeeTransitionResult>> BatchTransition(
        [FromBody] BatchInspectorFeeTransitionRequest request,
        CancellationToken ct)
    {
        var action = request.Action.Trim().ToLowerInvariant();
        var ctx = await BuildActorContextAsync(ct);
        if (ctx.UserId is null) return Unauthorized();
        if (!IsAuthorizedForAction(action, ctx))
            return Forbid();

        var result = await _fees.BatchTransitionAsync(
            request,
            ctx.UserId,
            ctx.AssigneeId,
            ctx.IsOperationsManager,
            ctx.IsFinancialOfficer,
            ct,
            ctx.Department,
            ctx.CanManageAllDepartments);
        return Ok(result);
    }

    [HttpPost("disbursement-batch")]
    public ActionResult CreateDisbursementBatch([FromBody] CreateDisbursementBatchRequest? request)
    {
        // ج٩ / ق٦: path retired — party fees bill through statements.
        return StatusCode(
            StatusCodes.Status410Gone,
            new
            {
                error = "إنشاء طلب صرف متوقف — البنود الجاهزة تُفوتر عبر كشف الأطراف.",
            });
    }

    private static bool IsAuthorizedForAction(string action, ActorContext ctx)
    {
        return action switch
        {
            InspectorFeeActions.SubmitToSupervisor
                or InspectorFeeActions.CreateDisbursementRequest
                or InspectorFeeActions.OfficeApproveDiscount
                or InspectorFeeActions.OfficeDispute =>
                !string.IsNullOrWhiteSpace(ctx.AssigneeId),

            InspectorFeeActions.ApproveToFinance
                or InspectorFeeActions.ResendToFinance
                or InspectorFeeActions.ReturnToOffice
                or InspectorFeeActions.ResolveDispute
                or InspectorFeeActions.Suspend
                or InspectorFeeActions.LiftSuspension => ctx.CanSuperviseAnyDepartment,

            InspectorFeeActions.Disburse
                or InspectorFeeActions.ReturnToSupervisor
                or InspectorFeeActions.InquiryToOffice => ctx.IsFinancialOfficer,

            _ => false,
        };
    }

    private async Task<ActorContext> BuildActorContextAsync(CancellationToken ct)
    {
        string? userId = ActorClaims.Id(User);
        if (userId is "unknown" or "")
            userId = null;
        var isOperationsManager = User.HasClaim(
            PlatformCapabilities.ClaimType,
            PlatformCapabilities.ManageOperations);
        var isFinancialOfficer = User.HasClaim(
            PlatformCapabilities.ClaimType,
            PlatformCapabilities.ManageFinancial);

        string? assigneeId = null;
        string? department = null;
        string? prototypeRole = null;
        if (!string.IsNullOrWhiteSpace(userId))
        {
            var permissions = await _permissions.GetForUserIdAsync(userId, ct);
            assigneeId = permissions?.DistributionAssigneeId;
            department = permissions?.Department;
            prototypeRole = permissions?.PrototypeRole;
        }

        return new ActorContext(
            userId,
            assigneeId,
            prototypeRole,
            department,
            isOperationsManager,
            isFinancialOfficer);
    }

    private sealed record ActorContext(
        string? UserId,
        string? AssigneeId,
        string? PrototypeRole,
        string? Department,
        bool IsOperationsManager,
        bool IsFinancialOfficer)
    {
        public bool CanManageAllDepartments =>
            PrototypeRole is "cdo" or "general-manager";

        public bool CanSuperviseAnyDepartment =>
            CanManageAllDepartments
            || PrototypeRole is "section-supervisor" or "case-specialist";

        public string? VisibleDepartment =>
            PrototypeRole is "section-supervisor" or "case-specialist"
                // Fail closed: without department, do not open every queue.
                ? Department ?? SupervisingDepartments.Unassigned
                : null;

        public bool CanManage(string supervisingDepartment) =>
            SupervisingDepartments.CanManage(
                supervisingDepartment,
                Department,
                CanManageAllDepartments);

        /// <summary>
        /// Finance and nothing else. Operations resolves pricing disputes, so an actor who also holds
        /// that capability — a CDO or a general manager — still needs to see disputed lines.
        /// </summary>
        public bool IsFinanceOnly => IsFinancialOfficer && !IsOperationsManager;
    }
}
