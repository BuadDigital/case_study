using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
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

    public async Task<IReadOnlyList<UserListItemDto>> ListDistributionAssigneesAsync(
        CancellationToken cancellationToken = default)
    {
        var all = await ListAsync(null, cancellationToken);
        return all
            .Where(u =>
                u.Status == UserStatus.Active
                && !string.IsNullOrWhiteSpace(u.DistributionAssigneeId))
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
            var orgRole = roles.FirstOrDefault(r =>
                OrgRoles.IsOrgRole(r)
                || OrgRoles.RetiredDepartmentAdmins.Contains(r));
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
}
