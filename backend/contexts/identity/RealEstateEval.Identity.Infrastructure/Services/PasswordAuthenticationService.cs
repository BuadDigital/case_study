using Microsoft.AspNetCore.Identity;
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
        var user = await LoginUserResolver.FindAsync(
            userManager,
            usernameOrEmail,
            cancellationToken);
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
}
