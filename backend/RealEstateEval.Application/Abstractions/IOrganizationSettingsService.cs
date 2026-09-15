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

    /// <summary>
    /// Link or hide a valuers-roster row for a staff appraiser account.
    /// Taqeem membership and signature stay on the roster screen.
    /// </summary>
    Task<OrganizationSettingsDto> SyncStaffValuerAsync(
        SyncStaffValuerRequest request,
        string actorId,
        CancellationToken cancellationToken = default);
}
