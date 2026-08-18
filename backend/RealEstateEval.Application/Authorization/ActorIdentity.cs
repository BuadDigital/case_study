using System.Security.Claims;

namespace RealEstateEval.Application.Authorization;

/// <summary>
/// Shared JWT actor lookup so hosts and application services do not re-parse claim types.
/// NameClaimType is <c>sub</c>, so <see cref="ClaimsIdentity.Name"/> is the user id.
/// </summary>
public static class ActorIdentity
{
    public static string? TryUserId(ClaimsPrincipal? user)
    {
        if (user is null)
            return null;

        var id = user.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? user.FindFirst("sub")?.Value;
        return string.IsNullOrWhiteSpace(id) ? null : id;
    }

    public static string? TryRole(ClaimsPrincipal? user)
    {
        var role = user?.FindFirst("role")?.Value?.Trim()
            ?? user?.FindFirst(ClaimTypes.Role)?.Value?.Trim();
        return string.IsNullOrWhiteSpace(role) ? null : role;
    }
}
