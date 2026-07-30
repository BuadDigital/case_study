using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Authorization;
using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Infrastructure.Services;

/// <summary>
/// Resolves the caller's permissions from the access-token claims issued at login.
/// Non-Identity APIs use this so they no longer open the Identity stores (Phase 1 step 2).
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

        var authenticatedUserId =
            principal.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? principal.FindFirstValue("sub");
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

        if (pages.Count == 0)
            pages.Add("system-screen-catalog");

        if (!capabilities.Contains("authenticated", StringComparer.OrdinalIgnoreCase))
            capabilities.Add("authenticated");

        return new PermissionsDto
        {
            UserId = userId,
            IdentityRoles = roles,
            PrototypeRole = principal.FindFirstValue("prototypeRole"),
            DisplayName = principal.FindFirstValue("displayName"),
            DistributionAssigneeId = principal.FindFirstValue("distributionAssigneeId"),
            Pages = pages,
            Capabilities = capabilities,
        };
    }
}
