using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Identity.Application.Abstractions;

namespace RealEstateEval.Identity.Infrastructure.Services;

public sealed class PasswordAuthenticationService(
    UserManager<ApplicationUser> userManager,
    SignInManager<ApplicationUser> signInManager,
    IAuthSessionService sessions) : IPasswordAuthenticationService
{
    public async Task<LoginResponseDto?> AuthenticateAsync(
        string usernameOrEmail,
        string password,
        CancellationToken cancellationToken = default)
    {
        var login = usernameOrEmail.Trim();
        var user = login.Contains('@', StringComparison.Ordinal)
            ? await userManager.FindByEmailAsync(login)
            : await userManager.FindByNameAsync(login);

 // Keep username login compatible for API clients while the UI uses email.
        user ??= await userManager.FindByEmailAsync(login);

 // Mobile is the product login identifier (E.164 / local SA digits).
        if (user is null)
        {
            var mobile = NormalizeLoginMobile(login);
            if (mobile is not null)
            {
                user = await userManager.Users
                    .FirstOrDefaultAsync(u => u.PhoneNumber == mobile, cancellationToken);
            }
        }

        if (user is null)
            return null;

        var signInResult = await signInManager.CheckPasswordSignInAsync(
            user,
            password,
            lockoutOnFailure: true);
        if (!signInResult.Succeeded)
            return null;

        return await sessions.IssueForUserIdAsync(user.Id, cancellationToken);
    }

 /// <summary>العقد الموحّد مع التسجيل — SaudiMobiles.Normalize (ق٣).</summary>
    private static string? NormalizeLoginMobile(string raw) =>
        SaudiMobiles.Normalize(raw);
}
