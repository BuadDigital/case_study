using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Authorization;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Permissions;
using RealEstateEval.Shared.Web.Authorization;

namespace RealEstateEval.CaseStudy.Api.Controllers;

[ApiController]
[Route("api/operations-tasks")]
[Authorize]
public class OperationsTasksController : ControllerBase
{
    private readonly IOperationsTaskService _tasks;
    private readonly ApplicationDbContext _db;

    public OperationsTasksController(IOperationsTaskService tasks, ApplicationDbContext db)
    {
        _tasks = tasks;
        _db = db;
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

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<OperationsTaskDto>> Get(Guid id, CancellationToken ct)
    {
        var row = await _tasks.GetAsync(id, ct);
        return row is null ? NotFound() : Ok(row);
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
        if (error is not null) return BadRequest(new { error });
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
        if (error is not null) return BadRequest(new { error });
        if (result is null) return NotFound();
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
        if (error is not null) return BadRequest(new { error });
        if (result is null) return NotFound();
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
        if (error is not null) return BadRequest(new { error });
        if (result is null) return NotFound();
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
        if (error is not null) return BadRequest(new { error });
        if (result is null) return NotFound();
        return Ok(result);
    }

    private async Task<string?> ActorAssigneeIdAsync(CancellationToken ct)
    {
        var userId = ActorId();
        if (userId.Length == 0) return null;
        var profile = await _db.UserProfiles.AsNoTracking()
            .FirstOrDefaultAsync(p => p.UserId == userId, ct);
        return profile?.DistributionAssigneeId?.Trim();
    }

    /// <summary>
    /// JWT carries identity roles (Editor/CDO), not prototype roles. Resolve like PermissionService.
    /// </summary>
    private async Task<string> ActorPrototypeRoleAsync(CancellationToken ct)
    {
        var userId = ActorId();
        if (userId.Length == 0) return "";

        var profile = await _db.UserProfiles.AsNoTracking()
            .FirstOrDefaultAsync(p => p.UserId == userId, ct);

        var identityRoles = await (
            from ur in _db.UserRoles.AsNoTracking()
            join r in _db.Roles.AsNoTracking() on ur.RoleId equals r.Id
            where ur.UserId == userId
            select r.Name!
        ).ToListAsync(ct);

        var resolved = PrototypeRoleResolver.Resolve(profile, identityRoles);
        if (!string.IsNullOrWhiteSpace(resolved))
            return resolved;

        // Capability fallback: anyone who can manage WOs/ops is an ops manager.
        if (HasCapability(PlatformCapabilities.ManageWorkOrders)
            || HasCapability(PlatformCapabilities.ManageOperations)
            || HasCapability(PlatformCapabilities.ManageSystemConfig))
        {
            return "case-specialist";
        }

        return User.FindFirstValue("role")?.Trim()
            ?? User.FindFirstValue(ClaimTypes.Role)?.Trim()
            ?? "";
    }

    private bool HasCapability(string capability) =>
        User.HasClaim(PlatformCapabilities.ClaimType, capability);

    private string ActorId() =>
        User.FindFirstValue(ClaimTypes.NameIdentifier)?.Trim()
        ?? User.FindFirstValue("sub")?.Trim()
        ?? "";

    private string? ActorName() =>
        User.FindFirstValue("displayName")?.Trim()
        ?? User.FindFirstValue("name")?.Trim()
        ?? User.Identity?.Name?.Trim();
}
