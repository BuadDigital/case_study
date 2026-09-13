using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Platform.Application.Abstractions;

/// <summary>Organization-settings values the valuation report prints empty: who to ask, and asking them.</summary>
public interface IOrganizationSettingsGapService
{
    Task<OrganizationSettingsSectionEditorsDto> GetSectionEditorsAsync(CancellationToken cancellationToken);

    Task<(int NotifiedCount, string RecipientName, string? Error)> NotifyAsync(
        NotifyOrganizationSettingsGapRequest request,
        string? actorDisplayName,
        CancellationToken cancellationToken);
}
