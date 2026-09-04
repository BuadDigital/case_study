using RealEstateEval.Domain;
using RealEstateEval.Platform.Domain;

namespace RealEstateEval.Platform.Application.Abstractions;

/// <summary>
/// Persistence boundary for the singleton organization settings and the immutable report
/// text-package registry (قرار 23). <c>OrganizationSettingsService</c> in
/// <c>Platform.Application</c> owns the merge, validation and masking rules; only the adapter
/// opens <c>PlatformDbContext</c> (solid-scorecard finding 1).
/// </summary>
public interface IOrganizationSettingsRepository
{
    /// <summary>Untracked singleton row, or <c>null</c> before the first save.</summary>
    Task<OrganizationSettings?> GetSettingsAsync(CancellationToken cancellationToken);

    /// <summary>Tracked singleton row for the save path.</summary>
    Task<OrganizationSettings?> FindSettingsAsync(CancellationToken cancellationToken);

    Task AddSettingsAsync(OrganizationSettings row, CancellationToken cancellationToken);

    /// <summary>Highest issued package version, or <c>null</c> when the registry is empty.</summary>
    Task<int?> GetLatestTextPackageVersionAsync(CancellationToken cancellationToken);

    /// <summary>Highest-versioned package row, or <c>null</c> when the registry is empty.</summary>
    Task<ValuationReportTextPackage?> GetLatestTextPackageAsync(CancellationToken cancellationToken);

    /// <summary>Stages a new immutable package version; existing rows are never updated.</summary>
    Task AddTextPackageAsync(ValuationReportTextPackage package, CancellationToken cancellationToken);

    /// <summary>Stages the audit row so it commits with the settings change (D7).</summary>
    Task AppendAuditAsync(AuditLog entry, CancellationToken cancellationToken);

    Task SaveChangesAsync(CancellationToken cancellationToken);
}
