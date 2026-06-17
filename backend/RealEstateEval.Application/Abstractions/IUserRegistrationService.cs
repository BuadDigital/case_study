using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;

namespace RealEstateEval.Application.Abstractions;

public interface IUserRegistrationService
{
    Task<IReadOnlyList<UserListItemDto>> ListAsync(
        RegistrationSource? sourceScope = null,
        CancellationToken cancellationToken = default);
    Task<(CreateUserResponseDto? Result, Dictionary<string, string>? Errors)> CreateHrAsync(
        RegistrationPayloadDto data,
        CancellationToken cancellationToken = default);
    Task<(CreateUserResponseDto? Result, Dictionary<string, string>? Errors)> CreateProcAsync(
        RegistrationPayloadDto data,
        CancellationToken cancellationToken = default);
    Task<(CreateUserResponseDto? Result, Dictionary<string, string>? Errors)> CreateCrmAsync(
        RegistrationPayloadDto data,
        CancellationToken cancellationToken = default);

    /// <summary>Deletes all users created via registration (have a profile). Keeps seeded admin.</summary>
    Task<int> DeleteAllRegisteredAsync(CancellationToken cancellationToken = default);

    Task<OrganizationOverviewDto> GetOrganizationOverviewAsync(
        CancellationToken cancellationToken = default);

    Task<(UserListItemDto? Result, string? Error)> UpdateUserAsync(
        string userId,
        UpdateUserRequest request,
        RegistrationSource? sourceScope = null,
        CancellationToken cancellationToken = default);

    Task<(UserListItemDto? Result, string? Error)> DeactivateUserAsync(
        string userId,
        RegistrationSource? sourceScope = null,
        CancellationToken cancellationToken = default);
}
