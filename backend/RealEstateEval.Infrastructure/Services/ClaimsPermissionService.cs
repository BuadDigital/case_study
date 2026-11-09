using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Authorization;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;

namespace RealEstateEval.Infrastructure.Services;

/// <summary>
/// Resolves the caller's permissions from the access-token claims issued at login.
/// Non-Identity APIs use this so they no longer open the Identity stores.
/// </summary>
public sealed class ClaimsPermissionService(IHttpContextAccessor httpContextAccessor) : IPermissionService
{
    public Task<PermissionsDto?> GetForUserIdAsync(
        string userId,
        CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var principal = httpContextAccessor.HttpContext?.User;
        if (principal?.Identity?.IsAuthenticated != true)
            return Task.FromResult<PermissionsDto?>(null);

        var authenticatedUserId = ActorIdentity.TryUserId(principal);
        if (string.IsNullOrWhiteSpace(authenticatedUserId)
            || !string.Equals(authenticatedUserId, userId, StringComparison.Ordinal))
        {
            return Task.FromResult<PermissionsDto?>(null);
        }

        return Task.FromResult<PermissionsDto?>(FromPrincipal(principal, authenticatedUserId));
    }

    public static PermissionsDto FromPrincipal(ClaimsPrincipal principal, string userId)
    {
        var roles = principal.FindAll("role").Select(c => c.Value).Distinct(StringComparer.Ordinal).ToList();
        var capabilities = principal.FindAll(PlatformCapabilities.ClaimType)
            .Select(c => c.Value)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(c => c, StringComparer.Ordinal)
            .ToList();
        var pages = principal.FindAll("page")
            .Select(c => c.Value)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(c => c, StringComparer.Ordinal)
            .ToList();

 // Empty page set is intentional; screen catalog is CDO/super-admin only.

        if (!capabilities.Contains("authenticated", StringComparer.OrdinalIgnoreCase))
            capabilities.Add("authenticated");

        var prototypeRole = principal.FindFirstValue("prototypeRole");
        return new PermissionsDto
        {
            UserId = userId,
            IdentityRoles = roles,
            PrototypeRole = prototypeRole,
            DisplayName = principal.FindFirstValue("displayName"),
            DistributionAssigneeId = principal.FindFirstValue("distributionAssigneeId"),
            Department = principal.FindFirstValue("department"),
            JobTitle = principal.FindFirstValue("jobTitle"),
            Pages = pages,
            Capabilities = capabilities,
            SubRoles = SubRolesFrom(principal, prototypeRole),
        };
    }

    /// <summary>
    /// The case-specialist sub-roles carried by the token (one <c>subRole</c> claim each).
    /// </summary>
    /// <remarks>
    /// How it works: known words only, in the fixed coordination, study, review order.
    /// Edge cases: a case-specialist token with no sub-role claim was issued before the sub-roles
    /// existed (tokens live 15 minutes) and is read as holding all three — remove this shim one
    /// release after 2026-11. Any other role gets none, whatever its claims say.
    /// </remarks>
    public static IReadOnlyList<string> SubRolesFrom(ClaimsPrincipal principal, string? prototypeRole)
    {
        if (!string.Equals(prototypeRole?.Trim(), StaffRoleIds.CaseSpecialist, StringComparison.OrdinalIgnoreCase))
            return [];
        var flags = CaseSpecialistSubRoles.ToFlags(
            principal.FindAll(CaseSpecialistSubRoles.ClaimType).Select(c => c.Value));
        return flags == 0 ? CaseSpecialistSubRoles.All : CaseSpecialistSubRoles.FromFlags(flags);
    }
}
