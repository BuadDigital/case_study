using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Permissions;
using RealEstateEval.Infrastructure.Services;

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
                Code = string.IsNullOrWhiteSpace(s.Code) ? null : s.Code,
                OwnerRole = string.IsNullOrWhiteSpace(s.OwnerRole) ? null : s.OwnerRole,
                ScreenStatus = string.IsNullOrWhiteSpace(s.ScreenStatus) ? null : s.ScreenStatus,
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
            .ToListAsync(cancellationToken);

        var userIds = users.Select(u => u.Id).ToList();
        var profiles = await _db.UserProfiles
            .AsNoTracking()
            .Include(p => p.ProcProvider)
            .Where(p => userIds.Contains(p.UserId))
            .ToDictionaryAsync(p => p.UserId, cancellationToken);

        var roleRows = await (
            from ur in _db.UserRoles.AsNoTracking()
            join r in _db.Roles.AsNoTracking() on ur.RoleId equals r.Id
            where userIds.Contains(ur.UserId)
            select new { ur.UserId, RoleName = r.Name }
        ).ToListAsync(cancellationToken);

        var rolesByUser = roleRows
            .GroupBy(x => x.UserId)
            .ToDictionary(
                g => g.Key,
                g => (IReadOnlyList<string>)g.Select(x => x.RoleName).ToList());

        var dtos = users
            .Select(u =>
            {
                profiles.TryGetValue(u.Id, out var profile);
                var identityRoles = rolesByUser.GetValueOrDefault(u.Id, []);
                return new CustomAssignedScreenUserDto
                {
                    Id = u.Id,
                    DisplayName = u.DisplayName,
                    Email = u.Email ?? "",
                    UserName = u.UserName ?? "",
                    PrototypeRole = PrototypeRoleResolver.Resolve(profile, identityRoles),
                };
            })
            .ToList();

        return Ok(dtos);
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

        var validation = ValidateRequest(request);
        if (validation is not null)
            return BadRequest(new { error = validation });

        var linkedPageId = NormalizeTargetPageIdForStorage(request.TargetPageId);
        if (!string.IsNullOrWhiteSpace(linkedPageId))
        {
            var existingId = await _db.CustomAssignedScreens
                .AsNoTracking()
                .Where(s => s.TargetPageId == linkedPageId)
                .Select(s => s.Id)
                .FirstOrDefaultAsync(cancellationToken);
            if (existingId != Guid.Empty)
                return await Update(existingId, request, cancellationToken);
        }

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
            TargetPageId = linkedPageId,
            IconPath = string.IsNullOrWhiteSpace(request.IconPath)
                ? null
                : request.IconPath.Trim(),
            IsActive = request.IsActive,
            SortOrder = sortOrder,
            CreatedByUserId = userId,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        };

        if (!string.IsNullOrWhiteSpace(linkedPageId))
        {
            screen.Code = "";
            screen.OwnerRole = "";
            screen.ScreenStatus = "";
            screen.DefinitionJson = LinkedPageAccessMetadata.WriteExcludedUserIds(
                request.ExcludedUserIds);
        }
        else
        {
            screen.Code = await DynamicScreenDefinitionMapper.NextScreenCodeAsync(
                _db.CustomAssignedScreens,
                cancellationToken);
            screen.OwnerRole = "";
            screen.ScreenStatus = "مخططة";
            screen.DefinitionJson = DynamicScreenDefinitionMapper.Serialize(
                DynamicScreenDefinitionMapper.Empty(screen.Code));
        }

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

        var validation = ValidateRequest(request);
        if (validation is not null)
            return BadRequest(new { error = validation });

        var now = DateTime.UtcNow;
        var linkedPageId = NormalizeTargetPageIdForStorage(request.TargetPageId);
        screen.Name = request.Name.Trim();
        screen.TargetPageId = linkedPageId;
        screen.IconPath = string.IsNullOrWhiteSpace(request.IconPath)
            ? null
            : request.IconPath.Trim();
        screen.IsActive = request.IsActive;
        if (request.SortOrder > 0)
            screen.SortOrder = request.SortOrder;
        screen.UpdatedAtUtc = now;

        if (!string.IsNullOrWhiteSpace(linkedPageId))
        {
            screen.Code = "";
            screen.OwnerRole = "";
            screen.ScreenStatus = "";
            screen.DefinitionJson = LinkedPageAccessMetadata.WriteExcludedUserIds(
                request.ExcludedUserIds);
        }
        else if (string.IsNullOrWhiteSpace(screen.DefinitionJson) || screen.DefinitionJson == "{}")
        {
            screen.Code = string.IsNullOrWhiteSpace(screen.Code)
                ? await DynamicScreenDefinitionMapper.NextScreenCodeAsync(
                    _db.CustomAssignedScreens,
                    cancellationToken)
                : screen.Code;
            screen.ScreenStatus = "مخططة";
            screen.DefinitionJson = DynamicScreenDefinitionMapper.Serialize(
                DynamicScreenDefinitionMapper.Empty(screen.Code));
        }

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

    /// <summary>CDO — save dynamic screen definition (fields + layout).</summary>
    [HttpPut("{id:guid}/definition")]
    public async Task<ActionResult<CustomAssignedScreenDto>> SaveDefinition(
        Guid id,
        [FromBody] SaveDynamicScreenDefinitionRequest request,
        CancellationToken cancellationToken)
    {
        if (!IsCdo())
            return Forbid();

        var screen = await _db.CustomAssignedScreens
            .Include(s => s.Assignments)
            .FirstOrDefaultAsync(s => s.Id == id, cancellationToken);
        if (screen is null)
            return NotFound();

        var bindings = request.Bindings ?? [];
        var fields = request.Fields ?? [];
        var status = DynamicScreenDefinitionMapper.ResolveStatus(bindings.Count);
        var code = string.IsNullOrWhiteSpace(request.Code)
            ? (string.IsNullOrWhiteSpace(screen.Code)
                ? await DynamicScreenDefinitionMapper.NextScreenCodeAsync(
                    _db.CustomAssignedScreens,
                    cancellationToken)
                : screen.Code)
            : request.Code.Trim();

        var definition = new DynamicScreenDefinitionDto
        {
            Code = code,
            OwnerRole = "",
            Status = status,
            Fields = fields,
            Bindings = bindings,
        };

        var now = DateTime.UtcNow;
        screen.Code = code;
        screen.OwnerRole = "";
        screen.ScreenStatus = status;
        screen.DefinitionJson = DynamicScreenDefinitionMapper.Serialize(definition);
        screen.TargetPageId = "";
        screen.UpdatedAtUtc = now;

        await _db.SaveChangesAsync(cancellationToken);

        var userIds = screen.Assignments.Select(a => a.UserId).ToList();
        var usersById = await _users.Users
            .AsNoTracking()
            .Where(u => userIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, cancellationToken);

        return Ok(ToDto(screen, usersById));
    }

    /// <summary>Assigned user — load their submission for a dynamic screen.</summary>
    [HttpGet("{id:guid}/submission/mine")]
    public async Task<ActionResult<DynamicScreenSubmissionDto>> GetMySubmission(
        Guid id,
        CancellationToken cancellationToken)
    {
        var userId = CurrentUserId();
        if (userId is null)
            return Unauthorized();

        if (!await CanAccessScreen(id, userId, cancellationToken))
            return Forbid();

        var row = await _db.CustomScreenSubmissions
            .AsNoTracking()
            .FirstOrDefaultAsync(
                s => s.ScreenId == id && s.UserId == userId,
                cancellationToken);

        if (row is null)
        {
            return Ok(new DynamicScreenSubmissionDto
            {
                Id = Guid.Empty,
                ScreenId = id,
                UserId = userId,
                Answers = new Dictionary<string, object?>(),
                IsDraft = true,
                UpdatedAtUtc = DateTime.UtcNow,
                SubmittedAtUtc = null,
            });
        }

        return Ok(DynamicScreenDefinitionMapper.ToSubmissionDto(row));
    }

    /// <summary>Assigned user — save draft or final submission.</summary>
    [HttpPut("{id:guid}/submission/mine")]
    public async Task<ActionResult<DynamicScreenSubmissionDto>> SaveMySubmission(
        Guid id,
        [FromBody] SaveDynamicScreenSubmissionRequest request,
        CancellationToken cancellationToken)
    {
        var userId = CurrentUserId();
        if (userId is null)
            return Unauthorized();

        if (!await CanAccessScreen(id, userId, cancellationToken))
            return Forbid();

        var screen = await _db.CustomAssignedScreens
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == id, cancellationToken);
        if (screen is null)
            return NotFound();

        if (!string.IsNullOrWhiteSpace(screen.TargetPageId))
            return BadRequest(new { error = "screen is not dynamic" });

        var validationError = ValidateSubmission(screen, request);
        if (validationError is not null)
            return BadRequest(new { error = validationError });

        var now = DateTime.UtcNow;
        var row = await _db.CustomScreenSubmissions
            .FirstOrDefaultAsync(
                s => s.ScreenId == id && s.UserId == userId,
                cancellationToken);

        if (row is null)
        {
            row = new CustomScreenSubmission
            {
                Id = Guid.NewGuid(),
                ScreenId = id,
                UserId = userId,
                AnswersJson = DynamicScreenDefinitionMapper.SerializeAnswers(request.Answers),
                IsDraft = request.IsDraft,
                UpdatedAtUtc = now,
                SubmittedAtUtc = request.IsDraft ? null : now,
            };
            _db.CustomScreenSubmissions.Add(row);
        }
        else
        {
            row.AnswersJson = DynamicScreenDefinitionMapper.SerializeAnswers(request.Answers);
            row.IsDraft = request.IsDraft;
            row.UpdatedAtUtc = now;
            if (!request.IsDraft)
                row.SubmittedAtUtc = now;
        }

        await _db.SaveChangesAsync(cancellationToken);
        return Ok(DynamicScreenDefinitionMapper.ToSubmissionDto(row));
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

        var hasSubmissions = await _db.CustomScreenSubmissions
            .AnyAsync(s => s.ScreenId == id, cancellationToken);
        if (hasSubmissions)
            return BadRequest(new { error = "cannot delete screen with saved submissions" });

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

    private static string? ValidateRequest(SaveCustomAssignedScreenRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return "name is required";

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
            Code = string.IsNullOrWhiteSpace(screen.Code) ? null : screen.Code,
            OwnerRole = string.IsNullOrWhiteSpace(screen.OwnerRole) ? null : screen.OwnerRole,
            ScreenStatus = string.IsNullOrWhiteSpace(screen.ScreenStatus)
                ? null
                : screen.ScreenStatus,
            Definition = HasDynamicDefinition(screen)
                ? DynamicScreenDefinitionMapper.Parse(screen)
                : null,
            AssignedUserIds = assignedUsers.Select(u => u.Id).ToList(),
            AssignedUsers = assignedUsers,
            ExcludedUserIds = string.IsNullOrWhiteSpace(screen.TargetPageId)
                ? []
                : LinkedPageAccessMetadata.ReadExcludedUserIds(screen.DefinitionJson),
        };
    }

    private static bool HasDynamicDefinition(CustomAssignedScreen screen) =>
        string.IsNullOrWhiteSpace(screen.TargetPageId)
        && !string.IsNullOrWhiteSpace(screen.DefinitionJson)
        && screen.DefinitionJson != "{}";

    private async Task<bool> CanAccessScreen(
        Guid screenId,
        string userId,
        CancellationToken cancellationToken)
    {
        if (IsCdo())
            return true;

        return await _db.CustomAssignedScreenUsers
            .AsNoTracking()
            .AnyAsync(
                a => a.ScreenId == screenId && a.UserId == userId,
                cancellationToken);
    }

    private static string? ValidateSubmission(
        CustomAssignedScreen screen,
        SaveDynamicScreenSubmissionRequest request)
    {
        if (request.IsDraft)
            return null;

        var definition = DynamicScreenDefinitionMapper.Parse(screen);
        var fieldById = definition.Fields.ToDictionary(f => f.Id, StringComparer.Ordinal);
        foreach (var binding in definition.Bindings)
        {
            if (!string.Equals(binding.Mode, "input", StringComparison.OrdinalIgnoreCase))
                continue;
            if (!binding.Required)
                continue;
            if (!fieldById.TryGetValue(binding.FieldId, out var field))
                continue;

            request.Answers.TryGetValue(field.Id, out var value);
            if (value is null || (value is string s && string.IsNullOrWhiteSpace(s)))
                return $"required field missing: {field.Name}";
        }

        return null;
    }

    private static string NormalizeTargetPageIdForStorage(string? value) =>
        string.IsNullOrWhiteSpace(value) ? "" : value.Trim();

    private static string? NormalizeTargetPageIdForDto(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private string? CurrentUserId() =>
        User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);

    private bool IsCdo() =>
        User.IsInRole(OrgRoles.Cdo) || User.IsInRole("Admin");
}
