using RealEstateEval.Domain;
using RealEstateEval.Identity.Application.Rules;

namespace RealEstateEval.Identity.Infrastructure.Permissions;

/// <summary>
/// Resolves the one canonical product role stored on the user profile.
/// Job titles are display metadata and never grant permissions.
/// </summary>
/// <remarks>
/// The role ids and their job titles live in <see cref="StaffRoleCatalog"/> so the registration
/// use case in <c>Identity.Application</c> can reach them; this type stays in Infrastructure
/// because <see cref="Resolve"/> reads the persistence entity.
/// </remarks>
public static class PrototypeRoleResolver
{
 /// <summary>Prototype roles the CDO can assign when creating staff.</summary>
    public static IReadOnlyList<string> CreatableStaffRoleIds => StaffRoleCatalog.CreatableStaffRoleIds;

    public static bool IsCreatableStaffRoleId(string? roleId) =>
        StaffRoleCatalog.IsCreatableStaffRoleId(roleId);

    public static string? JobTitleForRoleId(string? roleId) =>
        StaffRoleCatalog.JobTitleForRoleId(roleId);

 /// <summary>Seed/migration compatibility only; authorization never calls this method.</summary>
    public static string? LegacyRoleIdForJobTitle(string? jobTitle) =>
        StaffRoleCatalog.RoleIdForJobTitle(jobTitle);

    public static string? Resolve(UserProfile? profile, IReadOnlyList<string> identityRoles)
    {
        if (identityRoles.Any(PlatformPermissionCatalog.IsSuperAdminIdentityRole))
            return "cdo";

        var roleId = profile?.RoleId?.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(roleId))
            return null;

        return StaffRoleCatalog.IsKnownRoleId(roleId) ? roleId : null;
    }
}
