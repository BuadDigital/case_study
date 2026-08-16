using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Application.Abstractions;

/// <summary>
/// Single owner of session lifetime: mints short-lived access tokens paired with a
/// rotating refresh token, so role, capability, and account-status changes take
/// effect at the next refresh instead of at access-token expiry.
/// </summary>
public interface IAuthSessionService
{
 /// <summary>
 /// Starts a new session for an already-authenticated user id. Returns null when
 /// the account is unknown or inactive.
 /// </summary>
    Task<LoginResponse?> IssueForUserIdAsync(
        string userId,
        CancellationToken cancellationToken = default);

 /// <summary>
 /// Starts a development session by username without exposing identity persistence
 /// to the API layer. Returns null for unknown or inactive accounts.
 /// </summary>
    Task<LoginResponse?> IssueForUsernameAsync(
        string username,
        CancellationToken cancellationToken = default);

 /// <summary>
 /// Rotates a refresh token and re-reads roles/capabilities from the database.
 /// Returns null for unknown, expired, revoked, or already-rotated tokens, and for
 /// accounts that are no longer active.
 /// </summary>
    Task<LoginResponse?> RefreshAsync(
        string refreshToken,
        CancellationToken cancellationToken = default);

 /// <summary>Revokes the session family behind one refresh token (logout).</summary>
    Task RevokeAsync(
        string refreshToken,
        string reason,
        CancellationToken cancellationToken = default);

 /// <summary>
 /// Revokes every active session for a user — used when an account is disabled,
 /// deleted, or has its roles changed.
 /// </summary>
    Task<int> RevokeAllForUserAsync(
        string userId,
        string reason,
        CancellationToken cancellationToken = default);
}
