using Microsoft.EntityFrameworkCore;
using RealEstateEval.Domain;
using RealEstateEval.Platform.Application.Abstractions;
using RealEstateEval.Platform.Domain;
using RealEstateEval.Platform.Infrastructure.Data.Contexts;

namespace RealEstateEval.Platform.Infrastructure.Persistence;

/// <summary>
/// EF adapter for <see cref="IOrganizationSettingsRepository"/>. The only place the
/// organization-settings use case reaches <see cref="PlatformDbContext"/>.
/// </summary>
public sealed class OrganizationSettingsRepository(PlatformDbContext db)
    : IOrganizationSettingsRepository
{
    public Task<OrganizationSettings?> GetSettingsAsync(CancellationToken cancellationToken) =>
        db.OrganizationSettings.AsNoTracking().FirstOrDefaultAsync(cancellationToken);

    public Task<OrganizationSettings?> FindSettingsAsync(CancellationToken cancellationToken) =>
        db.OrganizationSettings.FirstOrDefaultAsync(cancellationToken);

    public Task AddSettingsAsync(OrganizationSettings row, CancellationToken cancellationToken)
    {
        db.OrganizationSettings.Add(row);
        return Task.CompletedTask;
    }

    public Task<int?> GetLatestTextPackageVersionAsync(CancellationToken cancellationToken) =>
        db.ValuationReportTextPackages.AsNoTracking()
            .OrderByDescending(p => p.Version)
            .Select(p => (int?)p.Version)
            .FirstOrDefaultAsync(cancellationToken);

    public Task<ValuationReportTextPackage?> GetLatestTextPackageAsync(
        CancellationToken cancellationToken) =>
        db.ValuationReportTextPackages.AsNoTracking()
            .OrderByDescending(p => p.Version)
            .FirstOrDefaultAsync(cancellationToken);

    public Task AddTextPackageAsync(
        ValuationReportTextPackage package,
        CancellationToken cancellationToken)
    {
        db.ValuationReportTextPackages.Add(package);
        return Task.CompletedTask;
    }

    public Task AppendAuditAsync(AuditLog entry, CancellationToken cancellationToken)
    {
        db.AuditLogs.Add(entry);
        return Task.CompletedTask;
    }

    public Task SaveChangesAsync(CancellationToken cancellationToken) =>
        db.SaveChangesAsync(cancellationToken);
}
