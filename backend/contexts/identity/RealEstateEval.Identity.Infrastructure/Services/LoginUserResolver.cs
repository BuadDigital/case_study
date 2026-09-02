using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Domain;

namespace RealEstateEval.Identity.Infrastructure.Services;

internal static class LoginUserResolver
{
    public static async Task<ApplicationUser?> FindAsync(
        UserManager<ApplicationUser> userManager,
        string login,
        CancellationToken cancellationToken = default)
    {
        var trimmed = login.Trim();
        var user = trimmed.Contains('@', StringComparison.Ordinal)
            ? await userManager.FindByEmailAsync(trimmed)
            : await userManager.FindByNameAsync(trimmed);

        // Keep username login compatible for API clients while the UI uses email/mobile.
        user ??= await userManager.FindByEmailAsync(trimmed);

        if (user is not null)
            return user;

        var mobile = SaudiMobiles.Normalize(trimmed);
        if (mobile is null)
            return null;

        return await userManager.Users
            .FirstOrDefaultAsync(u => u.PhoneNumber == mobile, cancellationToken);
    }
}
