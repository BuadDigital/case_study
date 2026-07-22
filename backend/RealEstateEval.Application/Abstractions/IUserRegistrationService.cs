using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;

namespace RealEstateEval.Application.Abstractions;

public interface IUserRegistrationService
{
    Task<IReadOnlyList<UserListItemDto>> ListAsync(
        RegistrationSource? sourceScope = null,
        CancellationToken cancellationToken = default);

    /// <summary>Single user profile for the given identity user id, or null if none.</summary>
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

    Task<(CreateStaffUserResponseDto? Result, Dictionary<string, string>? Errors)> CreateStaffAsync(
        CreateStaffUserRequest request,
        CancellationToken cancellationToken = default);

    /// <summary>Deletes one staff user. Protects the caller and seeded primary admin accounts.</summary>
    Task<(bool Ok, string? Error)> DeleteStaffAsync(
        string userId,
        string? requestingUserId,
        CancellationToken cancellationToken = default);
}
