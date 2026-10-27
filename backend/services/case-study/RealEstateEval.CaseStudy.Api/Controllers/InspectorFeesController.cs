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
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.Financial.Domain;

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
    [Authorize(Policy = CapabilityPolicyNames.ReadPartyPayables)]
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
            hideAwaitingDiscountDecision: ctx.IsFinanceOnly,
            cancellationToken: ct,
            supervisingDepartment: ctx.VisibleDepartment));
    }

    [HttpGet("{workflowTaskId:guid}/transitions")]
    [Authorize(Policy = CapabilityPolicyNames.ReadPartyPayables)]
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
 // The list already hides lines awaiting a discount decision from finance; the history must
 // hide with it, otherwise the proposed amount leaks through the audit entries.
 // (This replaced the same guard for the retired «disputed» state.)
            var row = await _fees.GetByWorkflowTaskIdAsync(workflowTaskId, ct);
            if (row?.CanResolveDiscountProposal == true)
                return NotFound();
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
            ? this.BadRequestProblem("تعذّر حفظ الأتعاب — تحقق من الحالة والحسم والاستبعاد.")
            : Ok(row);
    }

    /// <summary>
    /// The department supervisor decides the specialist's proposed discount: approve, amend the
    /// amount, or waive it. Either way the line then goes to finance.
    /// </summary>
    /// <remarks>
    /// Two gates: the actor must be a supervisor at all (section supervisor, general manager or CDO —
    /// not the specialist who proposed), and Financial then checks the line's department. Errors come
    /// back as 400 with the Arabic reason.
    /// </remarks>
    [HttpPost("{workflowTaskId:guid}/discount-proposal/resolve")]
    [Authorize(Policy = CapabilityPolicyNames.ManageOperations)]
    public async Task<ActionResult<InspectorFeeRowDto>> ResolveDiscountProposal(
        Guid workflowTaskId,
        [FromBody] ResolveDiscountProposalRequest request,
        CancellationToken ct)
    {
        var ctx = await BuildActorContextAsync(ct);
        if (ctx.UserId is null) return Unauthorized();
        if (!ctx.CanSuperviseAnyDepartment) return Forbid();

        var (row, error) = await _fees.ResolveDiscountProposalAsync(
            workflowTaskId,
            request,
            ctx.UserId,
            ct,
            ctx.Department,
            ctx.CanManageAllDepartments);
        if (error is not null)
            return this.BadRequestProblem(error);
        return row is null ? NotFound() : Ok(row);
    }

    /// <summary>
    /// Cancels one party's whole fee on a transaction — typically an operationally complete one.
    /// Lines already in a statement or paid are left as they are and reported back.
    /// </summary>
    /// <remarks>
    /// Nothing in the system blocks this on a completed or Enfaz-handed-over transaction: what limits
    /// it is each line's billing state, which Financial enforces (see <c>WaivePartyFeesAsync</c>).
    /// </remarks>
    [HttpPost("transactions/{poNumber}/waive-party")]
    [Authorize(Policy = CapabilityPolicyNames.ManageOperations)]
    public async Task<ActionResult<WaivePartyFeesResultDto>> WaiveParty(
        string poNumber,
        [FromBody] WaivePartyFeesRequest request,
        CancellationToken ct)
    {
        var ctx = await BuildActorContextAsync(ct);
        if (ctx.UserId is null) return Unauthorized();
        if (!ctx.CanSuperviseAnyDepartment) return Forbid();

        var (result, error) = await _fees.WaivePartyFeesAsync(
            poNumber,
            request,
            ctx.UserId,
            ct,
            ctx.Department,
            ctx.CanManageAllDepartments);
        if (error is not null)
            return this.BadRequestProblem(error);
        return Ok(result);
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
            return this.BadRequestProblem(error);
        return row is null ? NotFound() : Ok(row);
    }

    [HttpPost("batch-transition")]
    public async Task<ActionResult<BatchInspectorFeeTransitionResponseDto>> BatchTransition(
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

    private static bool IsAuthorizedForAction(string action, ActorContext ctx)
    {
        return action switch
        {
            InspectorFeeActions.SubmitToSupervisor
                or InspectorFeeActions.CreateDisbursementRequest =>
                !string.IsNullOrWhiteSpace(ctx.AssigneeId),

            InspectorFeeActions.ApproveToFinance
                or InspectorFeeActions.ResendToFinance
                or InspectorFeeActions.ReturnToOffice
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

        /// <summary>
        /// Money decisions on party fees (discounts, approvals, suspensions) are the supervisor's.
        /// The case specialist proposes a discount when accepting outputs and decides nothing here.
        /// </summary>
        /// <remarks>
        /// Edge case fixed: the specialist used to be listed here, so with the fees page hidden they
        /// could still discount, approve or suspend through the API — and approve their own proposal.
        /// Reading the fee rows (<see cref="VisibleDepartment"/>) is unchanged.
        /// </remarks>
        public bool CanSuperviseAnyDepartment =>
            CanManageAllDepartments
            || PrototypeRole is "section-supervisor";

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
 /// Finance and nothing else. Operations decides proposed discounts, so an actor who also holds
 /// that capability — a CDO or a general manager — still needs to see lines awaiting a decision.
 /// </summary>
        public bool IsFinanceOnly => IsFinancialOfficer && !IsOperationsManager;
    }
}
