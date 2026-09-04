using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;
using RealEstateEval.Domain;
using RealEstateEval.Identity.Application.Abstractions;

namespace RealEstateEval.Identity.Infrastructure.Persistence;

/// <summary>
/// ASP.NET Identity adapter for <see cref="IStaffIdentityStore"/>. The only place the staff
/// registration use case reaches <see cref="UserManager{TUser}"/>; every result leaves here as a
/// plain value so <c>Identity.Application</c> compiles without the Identity packages.
/// </summary>
public sealed class StaffIdentityStore(
    UserManager<ApplicationUser> userManager,
    IOptions<DataProtectionTokenProviderOptions> activationTokenOptions) : IStaffIdentityStore
{
    public TimeSpan ActivationTokenLifespan => activationTokenOptions.Value.TokenLifespan;

    public async Task<StaffIdentityUser?> FindByIdAsync(
        string userId,
        CancellationToken cancellationToken) =>
        Map(await userManager.FindByIdAsync(userId));

    public async Task<StaffIdentityUser?> FindByEmailAsync(
        string email,
        CancellationToken cancellationToken) =>
        Map(await userManager.FindByEmailAsync(email));

    public async Task<StaffIdentityUser?> FindByNameOrEmailAsync(
        string userNameOrEmail,
        CancellationToken cancellationToken) =>
        Map(await userManager.FindByNameAsync(userNameOrEmail)
            ?? await userManager.FindByEmailAsync(userNameOrEmail));

    public async Task<IReadOnlyList<string>> GetRolesAsync(
        string userId,
        CancellationToken cancellationToken)
    {
        var user = await userManager.FindByIdAsync(userId);
        return user is null ? [] : [.. await userManager.GetRolesAsync(user)];
    }

    public async Task<(StaffIdentityUser? User, IReadOnlyList<StaffIdentityError> Errors)> CreateAsync(
        NewStaffIdentityUser user,
        CancellationToken cancellationToken)
    {
        var entity = new ApplicationUser
        {
            UserName = user.UserName,
            Email = user.Email,
            EmailConfirmed = true,
            DisplayName = user.DisplayName,
            PhoneNumber = user.PhoneNumber,
            PhoneNumberConfirmed = false,
        };

        var result = await userManager.CreateAsync(entity);
        return result.Succeeded ? (Map(entity), []) : (null, Errors(result));
    }

    public async Task<IReadOnlyList<StaffIdentityError>> AddToRoleAsync(
        string userId,
        string role,
        CancellationToken cancellationToken)
    {
        var user = await userManager.FindByIdAsync(userId);
        return user is null
            ? NotFound
            : Errors(await userManager.AddToRoleAsync(user, role));
    }

    public async Task<IReadOnlyList<StaffIdentityError>> RemoveFromRoleAsync(
        string userId,
        string role,
        CancellationToken cancellationToken)
    {
        var user = await userManager.FindByIdAsync(userId);
        return user is null
            ? NotFound
            : Errors(await userManager.RemoveFromRoleAsync(user, role));
    }

    public async Task<IReadOnlyList<StaffIdentityError>> UpdateAsync(
        StaffIdentityWrite write,
        CancellationToken cancellationToken)
    {
        var user = await userManager.FindByIdAsync(write.UserId);
        if (user is null)
            return NotFound;

        if (write.ResetPhoneConfirmation)
            user.PhoneNumberConfirmed = false;
        user.DisplayName = write.DisplayName;
        user.Email = write.Email;
        user.PhoneNumber = write.PhoneNumber;

        return Errors(await userManager.UpdateAsync(user));
    }

    public async Task<IReadOnlyList<StaffIdentityError>> DeleteAsync(
        string userId,
        CancellationToken cancellationToken)
    {
        var user = await userManager.FindByIdAsync(userId);
        return user is null
            ? NotFound
            : Errors(await userManager.DeleteAsync(user));
    }

    public async Task ClearLockoutAsync(string userId, CancellationToken cancellationToken)
    {
        var user = await userManager.FindByIdAsync(userId);
        if (user is null)
            return;

        await userManager.SetLockoutEndDateAsync(user, null);
        await userManager.ResetAccessFailedCountAsync(user);
    }

    public async Task LockOutIndefinitelyAsync(string userId, CancellationToken cancellationToken)
    {
        var user = await userManager.FindByIdAsync(userId);
        if (user is null)
            return;

        await userManager.SetLockoutEndDateAsync(user, DateTimeOffset.MaxValue);
    }

    public async Task<string?> GenerateActivationTokenAsync(
        string userId,
        CancellationToken cancellationToken)
    {
        var user = await userManager.FindByIdAsync(userId);
        return user is null ? null : await userManager.GeneratePasswordResetTokenAsync(user);
    }

    public async Task<IReadOnlyList<StaffIdentityError>> ResetPasswordAsync(
        string userId,
        string token,
        string newPassword,
        CancellationToken cancellationToken)
    {
        var user = await userManager.FindByIdAsync(userId);
        return user is null
            ? NotFound
            : Errors(await userManager.ResetPasswordAsync(user, token, newPassword));
    }

 /// <summary>
 /// Stands in for a row that vanished between the lookup and the write. The caller already
 /// checked the account exists, so this only surfaces a concurrent delete.
 /// </summary>
    private static readonly IReadOnlyList<StaffIdentityError> NotFound =
        [new StaffIdentityError("UserNotFound", "المستخدم غير موجود.")];

    private static StaffIdentityUser? Map(ApplicationUser? user) =>
        user is null
            ? null
            : new StaffIdentityUser(
                user.Id,
                user.UserName,
                user.Email,
                user.PhoneNumber,
                user.DisplayName);

    private static IReadOnlyList<StaffIdentityError> Errors(IdentityResult result) =>
        result.Succeeded
            ? []
            : [.. result.Errors.Select(e => new StaffIdentityError(e.Code, e.Description))];
}
