using Microsoft.EntityFrameworkCore;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Valuation.Infrastructure.Data.Contexts;

/// <summary>
/// Mapping of the imported valuation reports and their upload log. Applied by
/// <see cref="ValuationDbContext"/> only — kept out of <see cref="ValuationModel"/>, which the frozen
/// legacy context also applies.
/// </summary>
public static class ValuationReportImportsModel
{
    public static ModelBuilder ApplyValuationReportImportsModel(this ModelBuilder builder)
    {
        builder.Entity<ImportedValuationReport>(e =>
        {
            e.ToTable("ImportedValuationReports", DatabaseSchemas.Valuation);
            e.Property(x => x.Source).HasMaxLength(32).IsRequired();
            e.Property(x => x.ReportNumber).HasMaxLength(32).IsRequired();
            e.Property(x => x.Template).HasMaxLength(256);
            e.Property(x => x.Approver).HasMaxLength(256);
            e.Property(x => x.Client).HasMaxLength(512);
            e.Property(x => x.DeedNumber).HasMaxLength(64);
            e.Property(x => x.PropertyType).HasMaxLength(128).IsRequired();
            e.Property(x => x.Inspector).HasMaxLength(256);
            e.Property(x => x.Usage).HasMaxLength(128).IsRequired();
            e.Property(x => x.LandArea).HasPrecision(18, 2);
            e.Property(x => x.FinalValue).HasPrecision(18, 2);
            e.Property(x => x.InspectionAuditor).HasMaxLength(256);
            e.HasIndex(x => new { x.Source, x.ReportNumber }).IsUnique();
        });

        builder.Entity<ValuationReportImportBatch>(e =>
        {
            e.ToTable("ValuationReportImportBatches", DatabaseSchemas.Valuation);
            e.Property(x => x.Source).HasMaxLength(32).IsRequired();
            e.Property(x => x.FileName).HasMaxLength(260).IsRequired();
            e.Property(x => x.ImportedByUserId).HasMaxLength(128).IsRequired();
            e.Property(x => x.ImportedByName).HasMaxLength(256);
            e.Property(x => x.MaxReportNumber).HasMaxLength(32);
            e.HasIndex(x => new { x.Source, x.ImportedAtUtc });
        });

        return builder;
    }
}
