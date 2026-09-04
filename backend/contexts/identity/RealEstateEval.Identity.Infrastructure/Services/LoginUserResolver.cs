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

        var mobile = SaudiMobiles.Normalize(trimmed);
        if (mobile is not null)
        {
            return await userManager.Users
                .FirstOrDefaultAsync(u => u.PhoneNumber == mobile, cancellationToken);
        }

        return await userManager.FindByNameAsync(trimmed);
    }
}
