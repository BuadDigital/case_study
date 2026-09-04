namespace RealEstateEval.Identity.Application.Abstractions;

/// <summary>One ASP.NET Identity failure, flattened to plain strings.</summary>
public sealed record StaffIdentityError(string Code, string Description);

/// <summary>The account fields the registration use case reads. No store type crosses this line.</summary>
public sealed record StaffIdentityUser(
    string Id,
    string? UserName,
    string? Email,
    string? PhoneNumber,
    string DisplayName);

/// <summary>A password-less account to create; the holder redeems an activation ticket for one.</summary>
public sealed record NewStaffIdentityUser(
    string UserName,
    string Email,
    string DisplayName,
    string PhoneNumber);

/// <summary>
/// The account fields one staff edit rewrites. <paramref name="ResetPhoneConfirmation"/> is the
/// use case's decision: a new mobile is unconfirmed until its holder proves it.
/// </summary>
public sealed record StaffIdentityWrite(
    string UserId,
    string DisplayName,
    string? Email,
    string? PhoneNumber,
    bool ResetPhoneConfirmation);

/// <summary>
/// The account half of staff registration: lookups, role membership, lockout, and the
/// activation ticket. Only the Infrastructure adapter holds <c>UserManager</c>; every result
/// here is a plain value, so <c>UserRegistrationService</c> compiles without ASP.NET Identity
/// (solid-scorecard finding 1).
/// </summary>
/// <remarks>
/// The adapter shares the request's <c>IdentityDbContext</c> with
/// <see cref="IStaffRegistrationRepository"/>, so a write that lands here also flushes the
/// profile changes staged there — the behaviour the single-round-trip staff update relies on.
/// </remarks>
public interface IStaffIdentityStore
{
    /// <summary>How long an activation ticket stays redeemable.</summary>
    TimeSpan ActivationTokenLifespan { get; }

    Task<StaffIdentityUser?> FindByIdAsync(string userId, CancellationToken cancellationToken);

    Task<StaffIdentityUser?> FindByEmailAsync(string email, CancellationToken cancellationToken);

    /// <summary>Activation looks the holder up by username first, then by email.</summary>
    Task<StaffIdentityUser?> FindByNameOrEmailAsync(
        string userNameOrEmail,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<string>> GetRolesAsync(string userId, CancellationToken cancellationToken);

    /// <summary>Creates the account with no password. The created id comes back on success.</summary>
    Task<(StaffIdentityUser? User, IReadOnlyList<StaffIdentityError> Errors)> CreateAsync(
        NewStaffIdentityUser user,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<StaffIdentityError>> AddToRoleAsync(
        string userId,
        string role,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<StaffIdentityError>> RemoveFromRoleAsync(
        string userId,
        string role,
        CancellationToken cancellationToken);

    /// <summary>
    /// Rewrites the account fields and saves. The store refreshes the normalized email and
    /// commits every other change staged on the same context in the same round trip.
    /// </summary>
    Task<IReadOnlyList<StaffIdentityError>> UpdateAsync(
        StaffIdentityWrite write,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<StaffIdentityError>> DeleteAsync(
        string userId,
        CancellationToken cancellationToken);

    /// <summary>Clears any lockout end date and the failed-attempt counter.</summary>
    Task ClearLockoutAsync(string userId, CancellationToken cancellationToken);

    /// <summary>Locks the account out with no end date — the soft-disable half.</summary>
    Task LockOutIndefinitelyAsync(string userId, CancellationToken cancellationToken);

    Task<string?> GenerateActivationTokenAsync(string userId, CancellationToken cancellationToken);

    /// <summary>Redeems an activation ticket and sets the account password.</summary>
    Task<IReadOnlyList<StaffIdentityError>> ResetPasswordAsync(
        string userId,
        string token,
        string newPassword,
        CancellationToken cancellationToken);
}
