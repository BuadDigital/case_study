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

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<OperationsTaskDto>>> List(
        [FromQuery] string? assigneeId,
        [FromQuery] string? createdBy,
        [FromQuery] string? status,
        CancellationToken ct)
    {
        return Ok(await _tasks.ListAsync(
            assigneeId,
            createdBy,
            status,
            ActorId(),
            await ActorAssigneeIdAsync(ct),
            await ActorPrototypeRoleAsync(ct),
            ct));
    }

    [HttpGet("court-visit-fees")]
    public async Task<ActionResult<IReadOnlyList<CourtVisitFeeReportRowDto>>> ListCourtVisitFees(
        [FromQuery] string? creditAssigneeId,
        CancellationToken ct)
    {
        var role = await ActorPrototypeRoleAsync(ct);
        if (!PoRoleMatrixRules.CanManageOperationsTasks(role))
        {
            creditAssigneeId = await ActorAssigneeIdAsync(ct);
            if (string.IsNullOrWhiteSpace(creditAssigneeId))
                return Forbid();
        }

        return Ok(await _tasks.ListCourtVisitFeesAsync(creditAssigneeId, ct));
    }

    [HttpPost]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
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
            await ActorPrototypeRoleAsync(ct),
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
            await ActorPrototypeRoleAsync(ct),
            ActorName(),
            ct);
        if (error is not null) return this.BadRequestProblem(error);
        if (result is null) return this.NotFoundProblem("المهمة غير موجودة.");
        return Ok(result);
    }

    [HttpPost("{id:guid}/reassign")]
    [Authorize(Policy = CapabilityPolicyNames.ManageWorkOrders)]
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
            await ActorPrototypeRoleAsync(ct),
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
            await ActorPrototypeRoleAsync(ct),
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
