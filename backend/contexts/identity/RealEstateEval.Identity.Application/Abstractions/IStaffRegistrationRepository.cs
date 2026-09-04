using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;

namespace RealEstateEval.Identity.Application.Abstractions;

/// <summary>
/// Every staff-profile column the registration use case reads or writes. One record serves both
/// directions: the repository hands back the stored state, the use case returns it with the
/// members it decided to change, and the adapter copies it onto the tracked row.
/// </summary>
public sealed record StaffProfileState
{
    public required string UserId { get; init; }
    public string? RoleId { get; init; }
    public string JobTitle { get; init; } = string.Empty;
    public string? PermissionLevel { get; init; }
    public ContractType ContractType { get; init; }
    public RegistrationSource RegistrationSource { get; init; }
    public string? Department { get; init; }
    public string? City { get; init; }
    public string? NationalId { get; init; }
    public string? AvatarUrl { get; init; }
    public string? InspectorType { get; init; }
    public bool HasCompensation { get; init; }
    public decimal? FeeValueSar { get; init; }
    public string? Iban { get; init; }
    public string? TaxNumber { get; init; }
    public string? CommercialRegistration { get; init; }
    public DateOnly? JoinedAt { get; init; }
    public string? DistributionAssigneeId { get; init; }
    public UserStatus Status { get; init; }
    public string? ReferenceNumber { get; init; }
    public DateTime CreatedAtUtc { get; init; }
    public DateTime? UpdatedAtUtc { get; init; }
}

/// <summary>One profiled account and the identity roles it holds — the organization overview input.</summary>
public sealed record StaffRoleMembership(
    string UserId,
    string DisplayName,
    string Email,
    string JobTitle,
    IReadOnlyList<string> SystemRoles);

/// <summary>
/// A database transaction the use case opened. <c>null</c> is returned instead on providers with
/// no transaction support, so the caller treats "no transaction" as the ordinary case.
/// </summary>
public interface IStaffWriteTransaction : IAsyncDisposable
{
    Task CommitAsync(CancellationToken cancellationToken);
}

/// <summary>
/// Persistence boundary for staff registration: the profile rows, the uniqueness guards, the
/// refresh tokens a disable revokes, the yearly user reference, and the audit rows each write
/// leaves. <c>UserRegistrationService</c> in <c>Identity.Application</c> owns the rules; only
/// the adapter opens <c>IdentityDbContext</c> (solid-scorecard finding 1).
/// </summary>
/// <remarks>
/// The list/detail reads come back as DTOs because they are projected in the database from the
/// profile, its user, and the two optional side profiles — the use case only forwards them.
/// Everything the use case decides about comes back as <see cref="StaffProfileState"/> instead.
/// </remarks>
public interface IStaffRegistrationRepository
{
    /// <summary>Active accounts offered by the development login switcher.</summary>
    Task<IReadOnlyList<DevLoginUserDto>> ListDevLoginUsersAsync(CancellationToken cancellationToken);

    /// <summary>Identity-only projection: no profile join, for callers that just need a name.</summary>
    Task<UserInfoDto?> GetIdentityUserAsync(string userId, CancellationToken cancellationToken);

    /// <summary>Newest profiles first, capped by the configured unpaginated list cap.</summary>
    Task<IReadOnlyList<UserListItemDto>> ListAsync(CancellationToken cancellationToken);

    /// <summary>Full staff item, with an identity-only fallback for unprofiled accounts.</summary>
    Task<UserListItemDto?> GetByUserIdAsync(string userId, CancellationToken cancellationToken);

    /// <summary>Every profiled account with its identity roles — the organization overview input.</summary>
    Task<IReadOnlyList<StaffRoleMembership>> ListStaffRoleMembershipsAsync(
        CancellationToken cancellationToken);

    /// <summary>Ids of accounts that carry a profile, i.e. accounts created by registration.</summary>
    Task<IReadOnlyList<string>> ListProfiledUserIdsAsync(CancellationToken cancellationToken);

    Task<bool> UserNameExistsAsync(string userName, CancellationToken cancellationToken);

    Task<bool> EmailInUseAsync(
        string email,
        string? exceptUserId,
        CancellationToken cancellationToken);

    Task<bool> PhoneNumberInUseAsync(
        string phoneNumber,
        string? exceptUserId,
        CancellationToken cancellationToken);

    Task<bool> NationalIdInUseAsync(
        string nationalId,
        string? exceptUserId,
        CancellationToken cancellationToken);

    Task<StaffProfileState?> FindProfileAsync(string userId, CancellationToken cancellationToken);

    /// <summary>Stages a new profile row; it commits with the next save.</summary>
    Task AddProfileAsync(StaffProfileState profile, CancellationToken cancellationToken);

    /// <summary>Copies the decided state onto the tracked profile row of the same user.</summary>
    Task ApplyProfileAsync(StaffProfileState profile, CancellationToken cancellationToken);

    /// <summary>Revokes every unrevoked refresh token of one account.</summary>
    Task RevokeActiveRefreshTokensAsync(
        string userId,
        DateTime revokedAtUtc,
        string reason,
        CancellationToken cancellationToken);

    /// <summary>Allocates the yearly US-{year}-{seq} reference from the identity schema.</summary>
    Task<(string? Reference, string? Error)> AllocateUserReferenceAsync(
        DateTime utcNow,
        CancellationToken cancellationToken);

    /// <summary>Stages an audit row so it commits with the change it describes.</summary>
    Task AddAuditLogAsync(AuditLog entry, CancellationToken cancellationToken);

    /// <summary>Opens a transaction, or returns <c>null</c> on a non-relational provider.</summary>
    Task<IStaffWriteTransaction?> BeginTransactionAsync(CancellationToken cancellationToken);

    Task SaveChangesAsync(CancellationToken cancellationToken);
}
