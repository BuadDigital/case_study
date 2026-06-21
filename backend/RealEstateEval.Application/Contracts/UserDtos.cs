using System.ComponentModel.DataAnnotations;
using RealEstateEval.Domain;

namespace RealEstateEval.Application.Contracts;

public class RegistrationPayloadDto : Dictionary<string, string>
{
}

public class UserDetailFieldDto
{
    public required string Section { get; init; }
    public required string Label { get; init; }
    public required string Value { get; init; }
}

public class UserListItemDto
{
    public required string Id { get; init; }
    public required string DisplayName { get; init; }
    public required string JobTitle { get; init; }
    public required string Email { get; init; }
    public required string UserName { get; init; }
    public required ContractType ContractType { get; init; }
    public required UserStatus Status { get; init; }
    public required RegistrationSource RegistrationSource { get; init; }
    public string? PhoneNumber { get; init; }
    public DateTime CreatedAtUtc { get; init; }
    public IReadOnlyList<string> SystemRoles { get; init; } = [];
    public IReadOnlyList<UserDetailFieldDto> Details { get; init; } = [];
}

public class CreateUserResponseDto
{
    public required UserListItemDto User { get; init; }
}

public class FieldErrorsResponseDto
{
    public required Dictionary<string, string> Errors { get; init; }
}

public class DeleteRegisteredUsersResponseDto
{
    public int DeletedCount { get; init; }
}