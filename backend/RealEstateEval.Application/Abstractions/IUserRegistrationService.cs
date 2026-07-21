using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;

namespace RealEstateEval.Application.Abstractions;

public interface IUserRegistrationService
{
    Task<IReadOnlyList<UserListItemDto>> ListAsync(
        RegistrationSource? sourceScope = null,
        CancellationToken cancellationToken = default);

    /// <summary>Active operational users eligible for work-order distribution.</summary>
    Task<IReadOnlyList<UserListItemDto>> ListDistributionAssigneesAsync(
        CancellationToken cancellationToken = default);

    /// <summary>Deletes all users created via registration (have a profile). Keeps seeded admin.</summary>
    Task<int> DeleteAllRegisteredAsync(CancellationToken cancellationToken = default);

    Task<OrganizationOverviewDto> GetOrganizationOverviewAsync(
        CancellationToken cancellationToken = default);
}
