using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Permissions;

namespace RealEstateEval.Infrastructure.Services;

public sealed class PermissionService : IPermissionService
{
    private readonly UserManager<ApplicationUser> _users;
    private readonly IdentityDbContext _db;
    public PermissionService(UserManager<ApplicationUser> users, IdentityDbContext db)
    {
        _users = users;
        _db = db;
    }

    public async Task<PermissionsDto?> GetForUserIdAsync(
        string userId,
        CancellationToken cancellationToken = default)
    {
        var user = await _users.FindByIdAsync(userId);
        if (user is null)
            return null;

        var identityRoles = await _users.GetRolesAsync(user);
        var profile = await _db.UserProfiles
            .AsNoTracking()
            .Include(p => p.ProcProvider)
            .Include(p => p.HrEmployee)
            .FirstOrDefaultAsync(p => p.UserId == userId, cancellationToken);
        var pages = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var capabilities = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var isSuperAdmin = identityRoles.Any(PlatformPermissionCatalog.IsSuperAdminIdentityRole);
        string? prototypeRole;

        if (isSuperAdmin)
        {
            PlatformPermissionCatalog.ApplySuperAdminGrant(pages, capabilities);
            prototypeRole = "cdo";
        }
        else
        {
            foreach (var role in identityRoles)
                PlatformPermissionCatalog.ApplyIdentityRole(role, pages, capabilities);

            prototypeRole = PrototypeRoleResolver.Resolve(profile, identityRoles.ToList());
            if (!string.IsNullOrWhiteSpace(prototypeRole))
                PlatformPermissionCatalog.ApplyPrototypeRole(prototypeRole, pages, capabilities);
        }

        // Empty page set is intentional for department-only identity roles; do not invent shell pages.

        capabilities.Add("authenticated");

        // Prefer the stored department; fall back to the legacy HR section label so seeded
        // supervisors whose UserProfile still says "إدارة التقييم العقاري" keep their authority.
        var department = SupervisingDepartments.NormalizeProfileValue(profile?.Department)
            ?? SupervisingDepartments.NormalizeProfileValue(profile?.HrEmployee?.Section)
            ?? SupervisingDepartments.DeriveForRole(prototypeRole ?? profile?.RoleId);

        return new PermissionsDto
        {
            UserId = userId,
            IdentityRoles = identityRoles.ToList(),
            PrototypeRole = prototypeRole,
            DisplayName = user.DisplayName,
            DistributionAssigneeId = profile?.DistributionAssigneeId?.Trim(),
            Department = department,
            Pages = pages.OrderBy(p => p).ToList(),
            Capabilities = capabilities.OrderBy(c => c).ToList(),
        };
    }

}
