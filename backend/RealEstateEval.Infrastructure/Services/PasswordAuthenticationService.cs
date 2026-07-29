using Microsoft.AspNetCore.Identity;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;

namespace RealEstateEval.Infrastructure.Services;

public sealed class PasswordAuthenticationService(
    UserManager<ApplicationUser> userManager,
    SignInManager<ApplicationUser> signInManager,
    IAuthSessionService sessions) : IPasswordAuthenticationService
{
    public async Task<LoginResponse?> AuthenticateAsync(
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
        if (user is null)
            return null;

        var signInResult = await signInManager.CheckPasswordSignInAsync(
            user,
            password,
            lockoutOnFailure: true);
        if (!signInResult.Succeeded)
            return null;

        return await sessions.IssueAsync(user, cancellationToken);
    }
}
