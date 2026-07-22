using System.Security.Claims;

namespace RealEstateEval.Shared.Web;

/// <summary>
/// Resolves the signed-in actor from JWT claims.
/// NameClaimType is configured as <c>sub</c>, so <see cref="ClaimsIdentity.Name"/> is the user id — never use it as a display name.
/// </summary>
public static class ActorClaims
{
    public static string Id(ClaimsPrincipal user) =>
        user.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? user.FindFirstValue("sub")
        ?? "unknown";

    public static string DisplayName(ClaimsPrincipal user)
    {
        var id = Id(user);
        foreach (var claimType in new[] { "displayName", "name", ClaimTypes.GivenName })
        {
            var value = user.FindFirstValue(claimType)?.Trim();
            if (string.IsNullOrWhiteSpace(value)) continue;
            if (string.Equals(value, id, StringComparison.OrdinalIgnoreCase)) continue;
            if (Guid.TryParse(value, out _)) continue;
            return value;
        }

        return "";
    }
}
