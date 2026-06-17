using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Platform.Api.Controllers;

[ApiController]
[Route("api/custom-assigned-screens")]
[Authorize]
public class CustomAssignedScreensController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly UserManager<ApplicationUser> _users;

    public CustomAssignedScreensController(
        ApplicationDbContext db,
        UserManager<ApplicationUser> users)
    {
        _db = db;
        _users = users;
    }

    /// <summary>Screens assigned to the signed-in user (sidebar).</summary>
    [HttpGet("mine")]
    public async Task<ActionResult<IReadOnlyList<CustomAssignedScreenDto>>> Mine(
        CancellationToken cancellationToken)
    {
        var userId = CurrentUserId();
        if (userId is null)
            return Unauthorized();

        var screens = await _db.CustomAssignedScreens
            .AsNoTracking()
            .Where(s => s.IsActive)
            .Where(s => s.Assignments.Any(a => a.UserId == userId))
            .OrderBy(s => s.SortOrder)
            .ThenBy(s => s.Name)
            .Select(s => new CustomAssignedScreenDto
            {
                Id = s.Id,
                Name = s.Name,
                TargetPageId = NormalizeTargetPageIdForDto(s.TargetPageId),
                IconPath = s.IconPath,
                IsActive = s.IsActive,
                SortOrder = s.SortOrder,
                UpdatedAtUtc = s.UpdatedAtUtc,
            })
            .ToListAsync(cancellationToken);

        return Ok(screens);
    }

    /// <summary>CDO — all custom screens with assignments.</summary>
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<CustomAssignedScreenDto>>> ListAll(
        CancellationToken cancellationToken)
    {
        if (!IsCdo())
            return Forbid();

        var screens = await _db.CustomAssignedScreens
            .AsNoTracking()
            .Include(s => s.Assignments)
            .OrderBy(s => s.SortOrder)
            .ThenBy(s => s.Name)
            .ToListAsync(cancellationToken);

        var userIds = screens
            .SelectMany(s => s.Assignments.Select(a => a.UserId))
            .Distinct()
            .ToList();

        var usersById = await _users.Users
            .AsNoTracking()
            .Where(u => userIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, cancellationToken);

        var dtos = screens.Select(s => ToDto(s, usersById)).ToList();
        return Ok(dtos);
    }

    /// <summary>CDO — users available for assignment.</summary>
    [HttpGet("assignable-users")]
    public async Task<ActionResult<IReadOnlyList<CustomAssignedScreenUserDto>>> AssignableUsers(
        CancellationToken cancellationToken)
    {
        if (!IsCdo())
            return Forbid();

        var users = await _users.Users
            .AsNoTracking()
            .OrderBy(u => u.DisplayName)
            .ThenBy(u => u.UserName)
            .Select(u => new CustomAssignedScreenUserDto
            {
                Id = u.Id,
                DisplayName = u.DisplayName,
                Email = u.Email ?? "",
                UserName = u.UserName ?? "",
            })
            .ToListAsync(cancellationToken);

        return Ok(users);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<CustomAssignedScreenDto>> GetById(
        Guid id,
        CancellationToken cancellationToken)
    {
        var userId = CurrentUserId();
        if (userId is null)
            return Unauthorized();

        var screen = await LoadScreen(id, cancellationToken);
        if (screen is null)
            return NotFound();

        if (!IsCdo() && !screen.Assignments.Any(a => a.UserId == userId))
            return Forbid();

        var userIds = screen.Assignments.Select(a => a.UserId).ToList();
        var usersById = await _users.Users
            .AsNoTracking()
            .Where(u => userIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, cancellationToken);

        return Ok(ToDto(screen, usersById));
    }

    [HttpPost]
    public async Task<ActionResult<CustomAssignedScreenDto>> Create(
        [FromBody] SaveCustomAssignedScreenRequest request,
        CancellationToken cancellationToken)
    {
        if (!IsCdo())
            return Forbid();

        var userId = CurrentUserId();
        if (userId is null)
            return Unauthorized();

        var validation = await ValidateRequest(request, null, cancellationToken);
        if (validation is not null)
            return BadRequest(new { error = validation });

        var now = DateTime.UtcNow;
        var sortOrder = request.SortOrder;
        if (sortOrder <= 0)
        {
            var maxSort = await _db.CustomAssignedScreens.MaxAsync(
                s => (int?)s.SortOrder,
                cancellationToken) ?? 0;
            sortOrder = maxSort + 1;
        }

        var screen = new CustomAssignedScreen
        {
            Id = Guid.NewGuid(),
            Name = request.Name.Trim(),
            TargetPageId = NormalizeTargetPageIdForStorage(request.TargetPageId),
            IconPath = string.IsNullOrWhiteSpace(request.IconPath)
                ? null
                : request.IconPath.Trim(),
            IsActive = request.IsActive,
            SortOrder = sortOrder,
            CreatedByUserId = userId,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        };

        await ApplyAssignments(screen, request.AssignedUserIds, now, cancellationToken);
        _db.CustomAssignedScreens.Add(screen);
        await _db.SaveChangesAsync(cancellationToken);

        var created = await LoadScreen(screen.Id, cancellationToken);
        var userIds = created!.Assignments.Select(a => a.UserId).ToList();
        var usersById = await _users.Users
            .AsNoTracking()
            .Where(u => userIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, cancellationToken);

        return CreatedAtAction(nameof(ListAll), ToDto(created, usersById));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<CustomAssignedScreenDto>> Update(
        Guid id,
        [FromBody] SaveCustomAssignedScreenRequest request,
        CancellationToken cancellationToken)
    {
        if (!IsCdo())
            return Forbid();

        var screen = await _db.CustomAssignedScreens
            .Include(s => s.Assignments)
            .FirstOrDefaultAsync(s => s.Id == id, cancellationToken);

        if (screen is null)
            return NotFound();

        var validation = await ValidateRequest(request, id, cancellationToken);
        if (validation is not null)
            return BadRequest(new { error = validation });

        var now = DateTime.UtcNow;
        screen.Name = request.Name.Trim();
        screen.TargetPageId = NormalizeTargetPageIdForStorage(request.TargetPageId);
        screen.IconPath = string.IsNullOrWhiteSpace(request.IconPath)
            ? null
            : request.IconPath.Trim();
        screen.IsActive = request.IsActive;
        if (request.SortOrder > 0)
            screen.SortOrder = request.SortOrder;
        screen.UpdatedAtUtc = now;

        _db.CustomAssignedScreenUsers.RemoveRange(screen.Assignments);
        screen.Assignments.Clear();
        await ApplyAssignments(screen, request.AssignedUserIds, now, cancellationToken);

        await _db.SaveChangesAsync(cancellationToken);

        var updated = await LoadScreen(id, cancellationToken);
        var userIds = updated!.Assignments.Select(a => a.UserId).ToList();
        var usersById = await _users.Users
            .AsNoTracking()
            .Where(u => userIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, cancellationToken);

        return Ok(ToDto(updated, usersById));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        if (!IsCdo())
            return Forbid();

        var screen = await _db.CustomAssignedScreens
            .FirstOrDefaultAsync(s => s.Id == id, cancellationToken);
        if (screen is null)
            return NotFound();

        _db.CustomAssignedScreens.Remove(screen);
        await _db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    private async Task<CustomAssignedScreen?> LoadScreen(
        Guid id,
        CancellationToken cancellationToken)
    {
        return await _db.CustomAssignedScreens
            .AsNoTracking()
            .Include(s => s.Assignments)
            .FirstOrDefaultAsync(s => s.Id == id, cancellationToken);
    }

    private async Task ApplyAssignments(
        CustomAssignedScreen screen,
        IReadOnlyList<string> assignedUserIds,
        DateTime now,
        CancellationToken cancellationToken)
    {
        var distinctIds = assignedUserIds
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Select(id => id.Trim())
            .Distinct()
            .ToList();

        if (distinctIds.Count == 0)
            return;

        var existing = await _users.Users
            .AsNoTracking()
            .Where(u => distinctIds.Contains(u.Id))
            .Select(u => u.Id)
            .ToListAsync(cancellationToken);

        foreach (var uid in existing)
        {
            screen.Assignments.Add(new CustomAssignedScreenUser
            {
                Id = Guid.NewGuid(),
                ScreenId = screen.Id,
                UserId = uid,
                AssignedAtUtc = now,
            });
        }
    }

    private async Task<string?> ValidateRequest(
        SaveCustomAssignedScreenRequest request,
        Guid? excludeId,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return "name is required";

        if (request.AssignedUserIds is null || request.AssignedUserIds.Count == 0)
            return "at least one user must be assigned";

        return null;
    }

    private static CustomAssignedScreenDto ToDto(
        CustomAssignedScreen screen,
        IReadOnlyDictionary<string, ApplicationUser> usersById)
    {
        var assignedUsers = screen.Assignments
            .Select(a =>
            {
                usersById.TryGetValue(a.UserId, out var user);
                return new CustomAssignedScreenUserDto
                {
                    Id = a.UserId,
                    DisplayName = user?.DisplayName ?? a.UserId,
                    Email = user?.Email ?? "",
                    UserName = user?.UserName ?? "",
                };
            })
            .OrderBy(u => u.DisplayName)
            .ToList();

        return new CustomAssignedScreenDto
        {
            Id = screen.Id,
            Name = screen.Name,
            TargetPageId = NormalizeTargetPageIdForDto(screen.TargetPageId),
            IconPath = screen.IconPath,
            IsActive = screen.IsActive,
            SortOrder = screen.SortOrder,
            UpdatedAtUtc = screen.UpdatedAtUtc,
            AssignedUserIds = assignedUsers.Select(u => u.Id).ToList(),
            AssignedUsers = assignedUsers,
        };
    }

    private static string NormalizeTargetPageIdForStorage(string? value) =>
        string.IsNullOrWhiteSpace(value) ? "" : value.Trim();

    private static string? NormalizeTargetPageIdForDto(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private string? CurrentUserId() =>
        User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);

    private bool IsCdo() => User.IsInRole(OrgRoles.Cdo);
}
