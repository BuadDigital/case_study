using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Application.Abstractions;

public interface IOrganizationSettingsService
{
    Task<OrganizationSettingsDto> GetAsync(CancellationToken cancellationToken = default);

    /// <summary>Unmasked settings for server-side providers (OTP delivery).</summary>
    Task<OrganizationSettingsDto> GetInternalAsync(CancellationToken cancellationToken = default);

    Task<OrganizationSettingsDto> SaveAsync(
        SaveOrganizationSettingsRequest request,
        string actorId,
        CancellationToken cancellationToken = default);
}
