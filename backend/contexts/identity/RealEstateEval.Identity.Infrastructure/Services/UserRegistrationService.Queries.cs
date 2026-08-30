using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Identity.Domain;

namespace RealEstateEval.Identity.Infrastructure.Services;

public partial class UserRegistrationService
{
    public async Task<IReadOnlyList<DevLoginUserDto>> ListDevLoginUsersAsync(
        CancellationToken cancellationToken = default)
    {
        return await (
            from user in _db.Users.AsNoTracking()
            join profile in _db.UserProfiles.AsNoTracking() on user.Id equals profile.UserId
            where profile.Status == UserStatus.Active && user.UserName != null
            orderby user.UserName == "sliman" ? 0 : 1, user.DisplayName
            select new DevLoginUserDto
            {
                Username = user.UserName!,
                Label = string.IsNullOrWhiteSpace(profile.JobTitle)
                    ? user.DisplayName
                    : $"{user.DisplayName} — {profile.JobTitle}",
            }).ToListAsync(cancellationToken);
    }

    public async Task<UserInfoDto?> GetIdentityUserAsync(
        string userId,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(userId))
            return null;

        return await _db.Users
            .AsNoTracking()
            .Where(user => user.Id == userId)
            .Select(user => new UserInfoDto
            {
                Id = user.Id,
                Email = user.Email ?? string.Empty,
                DisplayName = user.DisplayName,
            })
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<UserListItemDto>> ListAsync(
        RegistrationSource? sourceScope = null,
        CancellationToken cancellationToken = default)
    {
        var (_, take, _, _) = NpgsqlConfiguration.ResolveListPaging(null, null, _dbOptions);
        var rows = await _db.UserProfiles
            .AsNoTracking()
            .Include(p => p.User)
            .Include(p => p.HrEmployee)
            .Include(p => p.ProcProvider)
            .OrderByDescending(p => p.CreatedAtUtc)
            .Take(take)
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
            .Select(p => RegistrationMapper.ToListItem(
                p.User,
                p,
                rolesByUser.GetValueOrDefault(p.UserId, [])))
            .ToList();
    }

    public async Task<UserListItemDto?> GetByUserIdAsync(
        string userId,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(userId))
            return null;

        var profile = await _db.UserProfiles
            .AsNoTracking()
            .Include(p => p.User)
            .Include(p => p.HrEmployee)
            .Include(p => p.ProcProvider)
            .FirstOrDefaultAsync(p => p.UserId == userId, cancellationToken);

        var roles = await (
            from ur in _db.UserRoles.AsNoTracking()
            join r in _db.Roles.AsNoTracking() on ur.RoleId equals r.Id
            where ur.UserId == userId && r.Name != null
            select r.Name!
        ).ToListAsync(cancellationToken);

        if (profile is null)
        {
            var user = await _db.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(candidate => candidate.Id == userId, cancellationToken);
            if (user is null)
                return null;

            return new UserListItemDto
            {
                Id = user.Id,
                DisplayName = user.DisplayName,
                JobTitle = string.Empty,
                Email = user.Email ?? string.Empty,
                UserName = user.UserName ?? string.Empty,
                ContractType = ContractType.Internal,
                Status = UserStatus.Active,
                RegistrationSource = RegistrationSource.Hr,
                PhoneNumber = user.PhoneNumber,
                CreatedAtUtc = _time.UtcNow(),
                SystemRoles = roles,
                Details = [],
            };
        }

        return RegistrationMapper.ToListItem(profile.User, profile, roles);
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

        // GroupBy instead of ToDictionary: duplicate org role (e.g. CDO twice) must not drop the overview.
        var byRole = rows
            .Select(p => (Profile: p, Person: ToPerson(p)))
            .Where(x => x.Person is not null)
            .GroupBy(x => x.Person!.SystemRole)
            .ToDictionary(g => g.Key, g => g.First().Person!);

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
}
