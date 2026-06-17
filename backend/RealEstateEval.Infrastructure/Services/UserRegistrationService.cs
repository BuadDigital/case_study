using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Infrastructure.Services;

public class UserRegistrationService : IUserRegistrationService
{
    private readonly ApplicationDbContext _db;
    private readonly UserManager<ApplicationUser> _userManager;

    public UserRegistrationService(
        ApplicationDbContext db,
        UserManager<ApplicationUser> userManager)
    {
        _db = db;
        _userManager = userManager;
    }

    public async Task<IReadOnlyList<UserListItemDto>> ListAsync(
        RegistrationSource? sourceScope = null,
        CancellationToken cancellationToken = default)
    {
        var rows = await _db.UserProfiles
            .AsNoTracking()
            .Include(p => p.User)
            .Include(p => p.HrEmployee)
            .Include(p => p.ProcProvider)
            .Include(p => p.CrmClient)
            .OrderByDescending(p => p.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        var userIds = rows.Select(p => p.UserId).ToList();
        var roleRows = await (
            from ur in _db.UserRoles.AsNoTracking()
            join r in _db.Roles.AsNoTracking() on ur.RoleId equals r.Id
            where userIds.Contains(ur.UserId)
            select new { ur.UserId, RoleName = r.Name }
        ).ToListAsync(cancellationToken);

        var rolesByUser = roleRows
            .GroupBy(x => x.UserId)
            .ToDictionary(g => g.Key, g => (IReadOnlyList<string>)g.Select(x => x.RoleName).ToList());

        return rows
            .Where(p => sourceScope is null || p.RegistrationSource == sourceScope.Value)
            .Where(p =>
            {
                // Department lists (HR/PROC/CRM) show every account in that registration path,
                // including org setup admins seeded as HR employees.
                if (sourceScope is not null)
                    return true;

                var roles = rolesByUser.GetValueOrDefault(p.UserId, []);
                return !roles.Any(OrgRoles.IsOrgRole);
            })
            .Select(p => RegistrationMapper.ToListItem(
                p.User,
                p,
                rolesByUser.GetValueOrDefault(p.UserId, [])))
            .ToList();
    }

    public async Task<OrganizationOverviewDto> GetOrganizationOverviewAsync(
        CancellationToken cancellationToken = default)
    {
        var rows = await _db.UserProfiles
            .AsNoTracking()
            .Include(p => p.User)
            .ToListAsync(cancellationToken);

        var userIds = rows.Select(p => p.UserId).ToList();
        var roleRows = await (
            from ur in _db.UserRoles.AsNoTracking()
            join r in _db.Roles.AsNoTracking() on ur.RoleId equals r.Id
            where userIds.Contains(ur.UserId)
            select new { ur.UserId, RoleName = r.Name }
        ).ToListAsync(cancellationToken);

        var rolesByUser = roleRows
            .GroupBy(x => x.UserId)
            .ToDictionary(g => g.Key, g => g.Select(x => x.RoleName).ToList());

        OrgPersonDto? ToPerson(UserProfile p)
        {
            var roles = rolesByUser.GetValueOrDefault(p.UserId, []);
            var orgRole = roles.FirstOrDefault(OrgRoles.IsOrgRole);
            if (orgRole is null)
                return null;

            return new OrgPersonDto
            {
                Id = p.UserId,
                DisplayName = p.User.DisplayName,
                Email = p.User.Email ?? string.Empty,
                JobTitle = p.JobTitle,
                SystemRole = orgRole,
            };
        }

        var byRole = rows
            .Select(p => (Profile: p, Person: ToPerson(p)))
            .Where(x => x.Person is not null)
            .ToDictionary(x => x.Person!.SystemRole, x => x.Person!);

        return new OrganizationOverviewDto
        {
            Cdo = byRole.GetValueOrDefault(OrgRoles.Cdo),
            Departments =
            [
                new OrgDepartmentDto
                {
                    Code = "HR",
                    Title = "الموارد البشرية",
                    Description = "موظفون — كل أنواع التوظيف",
                    IsActive = true,
                    Admin = byRole.GetValueOrDefault(OrgRoles.HrAdmin),
                },
                new OrgDepartmentDto
                {
                    Code = "PROCUREMENT",
                    Title = "المالية والعقود",
                    Description = "مقدمو خدمة — أفراد ومؤسسات",
                    IsActive = true,
                    Admin = byRole.GetValueOrDefault(OrgRoles.ProcAdmin),
                },
                new OrgDepartmentDto
                {
                    Code = "CRM",
                    Title = "علاقات العملاء",
                    Description = "عملاء محتملون وفعليون",
                    IsActive = false,
                    Admin = byRole.GetValueOrDefault(OrgRoles.CrmAdmin),
                },
            ],
        };
    }

    public Task<(CreateUserResponseDto? Result, Dictionary<string, string>? Errors)> CreateHrAsync(
        RegistrationPayloadDto data,
        CancellationToken cancellationToken = default)
    {
        var (user, profile, hr) = RegistrationMapper.MapHr(data);
        profile.HrEmployee = hr;
        return CreateCoreAsync(
            data,
            RegistrationValidator.ValidateHr,
            user,
            profile,
            "hr_email",
            Get(data, "hr_pwd"),
            DepartmentRoles.Hr,
            cancellationToken);
    }

    public Task<(CreateUserResponseDto? Result, Dictionary<string, string>? Errors)> CreateProcAsync(
        RegistrationPayloadDto data,
        CancellationToken cancellationToken = default)
    {
        var (user, profile, proc) = RegistrationMapper.MapProc(data);
        profile.ProcProvider = proc;
        return CreateCoreAsync(
            data,
            RegistrationValidator.ValidateProc,
            user,
            profile,
            "pc_email",
            Get(data, "pc_pwd"),
            DepartmentRoles.Proc,
            cancellationToken);
    }

    public Task<(CreateUserResponseDto? Result, Dictionary<string, string>? Errors)> CreateCrmAsync(
        RegistrationPayloadDto data,
        CancellationToken cancellationToken = default)
    {
        var (user, profile, crm) = RegistrationMapper.MapCrm(data);
        profile.CrmClient = crm;
        return CreateCoreAsync(
            data,
            RegistrationValidator.ValidateCrm,
            user,
            profile,
            "crm_email",
            Get(data, "crm_pwd"),
            DepartmentRoles.Crm,
            cancellationToken);
    }

    private async Task<(CreateUserResponseDto? Result, Dictionary<string, string>? Errors)> CreateCoreAsync(
        RegistrationPayloadDto data,
        Func<RegistrationPayloadDto, Dictionary<string, string>> validate,
        ApplicationUser user,
        UserProfile profile,
        string emailFieldKey,
        string password,
        string? roleName,
        CancellationToken cancellationToken)
    {
        var errors = validate(data);
        if (errors.Count > 0)
            return (null, errors);

        var email = (user.Email ?? "").Trim().ToLowerInvariant();
        if (await _userManager.FindByEmailAsync(email) is not null)
        {
            return (null, new Dictionary<string, string>
            {
                [emailFieldKey] = "هذا البريد مستخدم مسبقاً",
            });
        }

        await using var tx = await _db.Database.BeginTransactionAsync(cancellationToken);

        var createResult = await _userManager.CreateAsync(user, password);
        if (!createResult.Succeeded)
        {
            await tx.RollbackAsync(cancellationToken);
            return (null, createResult.Errors.ToDictionary(
                _ => "hr_pwd",
                e => e.Description));
        }

        profile.UserId = user.Id;
        if (profile.HrEmployee is not null)
            profile.HrEmployee.UserId = user.Id;
        if (profile.ProcProvider is not null)
            profile.ProcProvider.UserId = user.Id;
        if (profile.CrmClient is not null)
            profile.CrmClient.UserId = user.Id;

        if (!string.IsNullOrEmpty(roleName))
            await _userManager.AddToRoleAsync(user, roleName);

        _db.UserProfiles.Add(profile);
        await _db.SaveChangesAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);

        IReadOnlyList<string> createdRoles = string.IsNullOrEmpty(roleName)
            ? []
            : [roleName];

        return (new CreateUserResponseDto
        {
            User = RegistrationMapper.ToListItem(user, profile, createdRoles),
        }, null);
    }

    public async Task<int> DeleteAllRegisteredAsync(
        CancellationToken cancellationToken = default)
    {
        const string protectedEmail = "admin@local.dev";

        var userIds = await _db.UserProfiles
            .Select(p => p.UserId)
            .ToListAsync(cancellationToken);

        var deleted = 0;
        foreach (var userId in userIds)
        {
            var user = await _userManager.FindByIdAsync(userId);
            if (user is null)
                continue;

            var email = (user.Email ?? "").Trim().ToLowerInvariant();
            if (email == protectedEmail)
                continue;

            var roles = await _userManager.GetRolesAsync(user);
            if (roles.Any(OrgRoles.IsOrgRole))
                continue;

            var result = await _userManager.DeleteAsync(user);
            if (!result.Succeeded)
            {
                throw new InvalidOperationException(
                    "Failed to delete user " + userId + ": "
                    + string.Join("; ", result.Errors.Select(e => e.Description)));
            }

            deleted++;
        }

        return deleted;
    }

    public async Task<(UserListItemDto? Result, string? Error)> UpdateUserAsync(
        string userId,
        UpdateUserRequest request,
        RegistrationSource? sourceScope = null,
        CancellationToken cancellationToken = default)
    {
        var profile = await _db.UserProfiles
            .Include(p => p.User)
            .FirstOrDefaultAsync(p => p.UserId == userId, cancellationToken);
        if (profile is null)
            return (null, "not_found");

        if (sourceScope is not null && profile.RegistrationSource != sourceScope.Value)
            return (null, "forbidden");

        var roles = await _userManager.GetRolesAsync(profile.User);
        if (roles.Any(OrgRoles.IsOrgRole))
            return (null, "forbidden");

        if (!string.IsNullOrWhiteSpace(request.DisplayName))
            profile.User.DisplayName = request.DisplayName.Trim();
        if (request.JobTitle is not null)
            profile.JobTitle = request.JobTitle.Trim();
        if (request.Status is not null)
            profile.Status = request.Status.Value;

        var updateResult = await _userManager.UpdateAsync(profile.User);
        if (!updateResult.Succeeded)
        {
            return (null, string.Join("; ", updateResult.Errors.Select(e => e.Description)));
        }

        await _db.SaveChangesAsync(cancellationToken);
        return (RegistrationMapper.ToListItem(profile.User, profile, roles.ToList()), null);
    }

    public Task<(UserListItemDto? Result, string? Error)> DeactivateUserAsync(
        string userId,
        RegistrationSource? sourceScope = null,
        CancellationToken cancellationToken = default) =>
        UpdateUserAsync(
            userId,
            new UpdateUserRequest { Status = UserStatus.Inactive },
            sourceScope,
            cancellationToken);

    private static string Get(RegistrationPayloadDto data, string key) =>
        data.TryGetValue(key, out var v) ? v : "";
}
