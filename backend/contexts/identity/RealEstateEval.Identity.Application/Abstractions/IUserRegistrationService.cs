using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Identity.Application.Abstractions;

public interface IUserRegistrationService
{
    Task<IReadOnlyList<DevLoginUserDto>> ListDevLoginUsersAsync(
        CancellationToken cancellationToken = default);

    Task<UserInfoDto?> GetIdentityUserAsync(
        string userId,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<UserListItemDto>> ListAsync(
        CancellationToken cancellationToken = default);

 /// <summary>Full staff profile, with an identity-only fallback for unprofiled users.</summary>
    Task<UserListItemDto?> GetByUserIdAsync(
        string userId,
        CancellationToken cancellationToken = default);

 /// <summary>Active operational users eligible for work-order distribution.</summary>
    Task<IReadOnlyList<UserListItemDto>> ListDistributionAssigneesAsync(
        CancellationToken cancellationToken = default);

 /// <summary>Deletes all users created via registration (have a profile). Keeps seeded admin.</summary>
    Task<int> DeleteAllRegisteredAsync(CancellationToken cancellationToken = default);

    Task<OrganizationOverviewDto> GetOrganizationOverviewAsync(
        CancellationToken cancellationToken = default);

 /// <summary>
 /// Creates a staff account with no password. The holder activates it with a ticket
 /// from <see cref="IssueActivationTicketAsync"/>; no secret is returned here.
 /// </summary>
    Task<(CreateStaffUserResponseDto? Result, Dictionary<string, string>? Errors)> CreateStaffAsync(
        CreateStaffUserRequest request,
        string actorId,
        CancellationToken cancellationToken = default);

 /// <summary>
 /// Applies a partial update to one staff account. Absent members keep their stored value;
 /// changing the role re-derives the job title, permission level and identity roles.
 /// </summary>
    Task<(UserListItemDto? Result, Dictionary<string, string>? Errors)> UpdateStaffAsync(
        string userId,
        UpdateStaffUserRequest request,
        string actorId,
        CancellationToken cancellationToken = default);

 /// <summary>Clears an Identity lockout so a locked-out holder can sign in again.</summary>
    Task<(bool Ok, string? Error)> UnlockStaffAsync(
        string userId,
        string actorId,
        CancellationToken cancellationToken = default);

 /// <summary>
 /// Issues a single-use, time-limited activation ticket for a staff account.
 /// Issuing a new ticket does not invalidate the existing password, if any.
 /// </summary>
    Task<(ActivationTicketDto? Ticket, string? Error)> IssueActivationTicketAsync(
        string userId,
        string actorId,
        CancellationToken cancellationToken = default);

 /// <summary>
 /// Redeems an activation ticket and sets the account's first (or replacement) password.
 /// Returns a single opaque error for every failure mode so the endpoint cannot be used
 /// to enumerate accounts.
 /// </summary>
    Task<(bool Ok, string? Error)> ActivateAccountAsync(
        ActivateAccountRequest request,
        CancellationToken cancellationToken = default);

 /// <summary>Soft-disables one staff user and revokes sessions; no identity row is deleted.</summary>
    Task<(bool Ok, string? Error)> DeleteStaffAsync(
        string userId,
        string? requestingUserId,
        CancellationToken cancellationToken = default);
}
