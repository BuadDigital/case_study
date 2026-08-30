using System.ComponentModel.DataAnnotations;
using RealEstateEval.Domain;

namespace RealEstateEval.Application.Contracts;

public class UserDetailFieldDto
{
    public required string Section { get; init; }
    public required string Label { get; init; }
    public required string Value { get; init; }
}

public class UserListItemDto
{
    public required string Id { get; init; }
 /// <summary>Numbering workshop: internal reference US-{year}-{5-digit seq}.</summary>
    public string? ReferenceNumber { get; init; }
    public required string DisplayName { get; init; }
    public required string JobTitle { get; init; }
    public required string Email { get; init; }
    public required string UserName { get; init; }
    public string? RoleId { get; init; }
    public string? Mobile { get; init; }
    public string? City { get; init; }
    public string? Department { get; init; }
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
    public IReadOnlyList<string> ReviewerCityCoverage { get; init; } = [];
    public required ContractType ContractType { get; init; }
    public required UserStatus Status { get; init; }
    public required RegistrationSource RegistrationSource { get; init; }
    public string? PhoneNumber { get; init; }
    public DateTime? LastLoginAtUtc { get; init; }
    public DateTime CreatedAtUtc { get; init; }
    public IReadOnlyList<string> SystemRoles { get; init; } = [];
    public IReadOnlyList<UserDetailFieldDto> Details { get; init; } = [];
}

public class FieldErrorsResponseDto
{
    public required Dictionary<string, string> Errors { get; init; }
}

public class DeleteRegisteredUsersResponseDto
{
    public int DeletedCount { get; init; }
}

public sealed class CreateStaffUserRequest
{
    public required string DisplayName { get; init; }
    public required string Email { get; init; }
    public required string Mobile { get; init; }
    public required string City { get; init; }
    public required string RoleId { get; init; }
    public string? Department { get; init; }
    public string? InspectorType { get; init; }
    public bool? HasCompensation { get; init; }
    public decimal? FeeValueSar { get; init; }
    public string? Iban { get; init; }
    public string? TaxNumber { get; init; }
    public string? CommercialRegistration { get; init; }
    public DateOnly? JoinedAt { get; init; }
    public string? AvatarUrl { get; init; }
    public required string NationalId { get; init; }
}

/// <summary>
/// Partial update. A null member leaves the stored value untouched; an empty string clears
/// an optional field. Mobile, city, role, name, email and national id can be replaced but
/// never cleared, because the unified model requires them.
/// </summary>
public sealed class UpdateStaffUserRequest
{
    public string? DisplayName { get; init; }
    public string? Email { get; init; }
    public string? Mobile { get; init; }
    public string? City { get; init; }
    public string? RoleId { get; init; }
    public string? Department { get; init; }
    public string? NationalId { get; init; }
    public string? AvatarUrl { get; init; }
    public string? InspectorType { get; init; }
    public bool? HasCompensation { get; init; }
    public decimal? FeeValueSar { get; init; }
    public string? Iban { get; init; }
    public string? TaxNumber { get; init; }
    public string? CommercialRegistration { get; init; }
    public DateOnly? JoinedAt { get; init; }

 /// <summary>Only Active and Disabled are accepted; activation and lockout own the rest.</summary>
    public UserStatus? Status { get; init; }
}

public sealed class CreateStaffUserResponseDto
{
    public required UserListItemDto User { get; init; }
    public required string UserName { get; init; }

 /// <summary>
 /// Always true: staff accounts are created without a password and cannot sign in
 /// until the holder redeems an activation ticket.
 /// </summary>
    public bool ActivationRequired { get; init; } = true;
}

/// <summary>
/// One-time, short-lived ticket that lets an account holder choose their first password.
/// Issued only through an explicit, separately authorized admin action — never as a
/// side effect of creating or listing users.
/// </summary>
public sealed class ActivationTicketDto
{
    public required string UserName { get; init; }
    public required string Token { get; init; }
    public required DateTime ExpiresAtUtc { get; init; }
}

public sealed class IssueActivationTicketRequest
{
    public string Id { get; init; } = "";
}

public sealed class ActivateAccountRequest
{
    [Required, MaxLength(256)]
    public string UserName { get; init; } = "";

    [Required, MaxLength(4096)]
    public string Token { get; init; } = "";

    [Required, MaxLength(256)]
    public string NewPassword { get; init; } = "";
}