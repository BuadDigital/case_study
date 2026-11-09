using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Authorization;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Shared.Web;
using RealEstateEval.Shared.Web.Authorization;
using RealEstateEval.Operations.Application.Contracts;
using RealEstateEval.Operations.Application.Abstractions;
using RealEstateEval.Domain;

namespace RealEstateEval.Operations.Api.Controllers;

[ApiController]
[Route("api/operations-tasks")]
[Authorize]
public class OperationsTasksController : ControllerBase
{
    private readonly IOperationsTaskService _tasks;
    private readonly IPermissionService _permissions;

    public OperationsTasksController(
        IOperationsTaskService tasks,
        IPermissionService permissions)
    {
        _tasks = tasks;
        _permissions = permissions;
    }

 /// <summary>
 /// Operations-task queue. Sending page or pageSize returns PagedResultDto; without them the
 /// response stays the plain array every existing caller expects. See
 /// docs/architecture/pagination-contract.md.
 /// </summary>
    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] string? assigneeId,
        [FromQuery] string? createdBy,
        [FromQuery] string? status,
        [FromQuery] int? page,
        [FromQuery] int? pageSize,
        [FromQuery] string? sort,
        [FromQuery] string? dir,
        [FromQuery] string? q,
        [FromQuery] string? scope,
        [FromQuery] string? type,
        [FromQuery] bool? activeOnly,
        [FromQuery] bool? excludeFailurePaused,
        CancellationToken ct)
    {
        var query = new OperationsTaskListQuery
        {
            AssigneeId = assigneeId,
            CreatedBy = createdBy,
            Status = status,
            Page = page,
            PageSize = pageSize,
            Sort = sort,
            Dir = dir,
            Q = q,
            Scope = scope,
            Type = type,
            ActiveOnly = activeOnly,
            ExcludeFailurePaused = excludeFailurePaused,
        };

        var actorId = ActorId();
        var actorAssigneeId = await ActorAssigneeIdAsync(ct);
        var actorStaff = await ActorStaffAsync(ct);

        if (query.IsPaged)
        {
            return Ok(await _tasks.ListPagedAsync(
                query, actorId, actorAssigneeId, actorStaff, ct));
        }

        return Ok(await _tasks.ListAsync(query, actorId, actorAssigneeId, actorStaff, ct));
    }

    [HttpGet("court-visit-fees")]
    public async Task<ActionResult<IReadOnlyList<CourtVisitFeeReportRowDto>>> ListCourtVisitFees(
        [FromQuery] string? creditAssigneeId,
        CancellationToken ct)
    {
        if (!PoRoleMatrixRules.CanManageOperationsTasks(await ActorStaffAsync(ct)))
        {
            creditAssigneeId = await ActorAssigneeIdAsync(ct);
            if (string.IsNullOrWhiteSpace(creditAssigneeId))
                return Forbid();
        }

        return Ok(await _tasks.ListCourtVisitFeesAsync(creditAssigneeId, ct));
    }

    [HttpPost]
    [Authorize(Policy = CapabilityPolicyNames.ManageOperationsTasks)]
    public async Task<ActionResult<OperationsTaskDto>> Create(
        [FromBody] CreateOperationsTaskRequest request,
        CancellationToken ct)
    {
        var (result, error) = await _tasks.CreateAsync(
            request,
            ActorId(),
            ActorName(),
            ct);
        if (error is not null) return this.BadRequestProblem(error);
        return Ok(result);
    }

    [HttpPatch("{id:guid}")]
    public async Task<ActionResult<OperationsTaskDto>> Patch(
        Guid id,
        [FromBody] PatchOperationsTaskRequest request,
        CancellationToken ct)
    {
        var (result, error) = await _tasks.PatchAsync(
            id,
            request,
            await ActorAssigneeIdAsync(ct) ?? ActorId(),
            ActorName(),
            await ActorStaffAsync(ct),
            ActorId(),
            ct);
        if (error is not null) return this.BadRequestProblem(error);
        if (result is null) return this.NotFoundProblem("المهمة غير موجودة.");
        return Ok(result);
    }

    [HttpPost("{id:guid}/comments")]
    public async Task<ActionResult<OperationsTaskDto>> AddComment(
        Guid id,
        [FromBody] AddOperationsTaskCommentRequest request,
        CancellationToken ct)
    {
        var (result, error) = await _tasks.AddCommentAsync(
            id,
            request,
            await ActorAssigneeIdAsync(ct) ?? ActorId(),
            await ActorStaffAsync(ct),
            ActorName(),
            ct);
        if (error is not null) return this.BadRequestProblem(error);
        if (result is null) return this.NotFoundProblem("المهمة غير موجودة.");
        return Ok(result);
    }

    /// <summary>The creator accepts what a completed task delivered (Omar 2026-11-05).</summary>
    [HttpPost("{id:guid}/accept-outputs")]
    public async Task<ActionResult<OperationsTaskDto>> AcceptOutputs(Guid id, CancellationToken ct)
    {
        var (result, error) = await _tasks.AcceptOutputsAsync(
            id,
            ActorId(),
            ActorName(),
            await ActorStaffAsync(ct),
            ct);
        if (error is not null) return this.BadRequestProblem(error);
        if (result is null) return this.NotFoundProblem("المهمة غير موجودة.");
        return Ok(result);
    }

    [HttpPost("{id:guid}/reassign")]
    [Authorize(Policy = CapabilityPolicyNames.ManageOperationsTasks)]
    public async Task<ActionResult<OperationsTaskDto>> Reassign(
        Guid id,
        [FromBody] ReassignOperationsTaskRequest request,
        CancellationToken ct)
    {
        var (result, error) = await _tasks.ReassignAsync(
            id,
            request,
            await ActorAssigneeIdAsync(ct) ?? ActorId(),
            ActorName(),
            await ActorStaffAsync(ct),
            ct);
        if (error is not null) return this.BadRequestProblem(error);
        if (result is null) return this.NotFoundProblem("المهمة غير موجودة.");
        return Ok(result);
    }

    [HttpPost("{id:guid}/remind")]
    public async Task<ActionResult<OperationsTaskDto>> Remind(
        Guid id,
        [FromBody] RemindOperationsTaskRequest? request,
        CancellationToken ct)
    {
        var (result, error) = await _tasks.RemindAsync(
            id,
            request?.Auto ?? false,
            ActorName(),
            await ActorStaffAsync(ct),
            ct);
        if (error is not null) return this.BadRequestProblem(error);
        if (result is null) return this.NotFoundProblem("المهمة غير موجودة.");
        return Ok(result);
    }

    private async Task<string?> ActorAssigneeIdAsync(CancellationToken ct)
    {
        var userId = ActorId();
        if (userId.Length == 0) return null;
        var permissions = await _permissions.GetForUserIdAsync(userId, ct);
        return permissions?.DistributionAssigneeId?.Trim();
    }

    /// <summary>
    /// JWT carries identity roles (Editor/CDO), not prototype roles. Resolve like PermissionService.
    /// </summary>
    /// <summary>
    /// The caller's role and case-specialist sub-roles. A caller the role resolver below promotes to
    /// «case-specialist» from its capabilities alone (no profile role) keeps every sub-role, as before.
    /// </summary>
    private async Task<StaffActor> ActorStaffAsync(CancellationToken ct)
    {
        var userId = ActorId();
        var permissions = userId.Length == 0 ? null : await _permissions.GetForUserIdAsync(userId, ct);
        var role = await ActorPrototypeRoleAsync(ct);
        var subRoles = string.IsNullOrWhiteSpace(permissions?.PrototypeRole) && role == StaffRoleIds.CaseSpecialist
            ? CaseSpecialistSubRoles.All
            : permissions?.SubRoles;
        return new StaffActor(role, subRoles);
    }

    private async Task<string> ActorPrototypeRoleAsync(CancellationToken ct)
    {
        var userId = ActorId();
        if (userId.Length == 0) return "";

        var permissions = await _permissions.GetForUserIdAsync(userId, ct);
        var resolved = permissions?.PrototypeRole;
        if (!string.IsNullOrWhiteSpace(resolved))
            return resolved;

        if (HasCapability(PlatformCapabilities.ManageWorkOrders)
            || HasCapability(PlatformCapabilities.ManageOperations)
            || HasCapability(PlatformCapabilities.ManageSystemConfig))
        {
            return "case-specialist";
        }

        return ActorClaims.Role(User) ?? "";
    }

    private bool HasCapability(string capability) =>
        User.HasClaim(PlatformCapabilities.ClaimType, capability);

    private string ActorId() => ActorClaims.Id(User);

    /// <summary>
    /// Never fall back to <see cref="System.Security.Claims.ClaimsIdentity.Name"/> —
    /// NameClaimType is <c>sub</c>, so Identity.Name is the user id GUID.
    /// </summary>
    private string ActorName() => ActorClaims.DisplayName(User);
}
