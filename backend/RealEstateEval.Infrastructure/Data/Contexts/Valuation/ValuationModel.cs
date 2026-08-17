using Microsoft.EntityFrameworkCore;
using RealEstateEval.Domain;

namespace RealEstateEval.Infrastructure.Data.Contexts;

/// <summary>
/// The <c>valuation</c> schema mapping and the display-id sequence. Applied by
/// <see cref="ValuationDbContext"/>, which owns the write path, and by the legacy context,
/// which still serves the Case Study dispatch pre-check until a Valuation owner call replaces it.
/// </summary>
internal static class ValuationModel
{
    public static ModelBuilder ApplyValuationModel(this ModelBuilder builder)
    {
        builder.Entity<ValuationRequest>(e =>
        {
            e.ToTable("ValuationRequests", DatabaseSchemas.Valuation);
            e.UseOptimisticConcurrency();
            e.Property(x => x.DisplayId).HasMaxLength(64);
            e.Property(x => x.PropertyId).HasMaxLength(128);
            e.Property(x => x.Area).HasMaxLength(128);
            e.Property(x => x.PropertyType).HasMaxLength(128);
            e.Property(x => x.Appraiser).HasMaxLength(256);
            e.Property(x => x.Status)
                .HasConversion(DomainEnumConverters.ValuationRequestStatus)
                .HasMaxLength(32);
            e.Property(x => x.RequestDate).HasMaxLength(32);
            e.HasIndex(x => x.DisplayId)
                .IsUnique()
                .HasDatabaseName(DatabaseIndexNames.ValuationRequestDisplayId);
 // One open request per property is the dispatch rule; a partial unique index both
 // enforces it against concurrent inserts and serves the "is one already open?" probe.
            e.HasIndex(x => x.PropertyId)
                .IsUnique()
                .HasFilter($"\"Status\" <> '{ValuationRequestStatuses.Done}'")
                .HasDatabaseName(DatabaseIndexNames.ValuationRequestOpenPerProperty);
        });

        builder.Entity<EvaluatorRecallRecord>(e =>
        {
            e.ToTable("EvaluatorRecallRecords", DatabaseSchemas.Valuation);
            e.UseOptimisticConcurrency();
            e.Property(x => x.TaskId).HasMaxLength(64);
            e.Property(x => x.PoNumber).HasMaxLength(64);
            e.Property(x => x.PropertyId).HasMaxLength(128);
            e.Property(x => x.Status).HasMaxLength(32);
            e.Property(x => x.Reason).HasMaxLength(4000);
            e.Property(x => x.SpecialistNote).HasMaxLength(4000);
            e.HasIndex(x => x.TaskId).IsUnique();
            e.HasIndex(x => x.Status);
        });

        builder.Entity<ComparableProperty>(e =>
        {
            e.ToTable("ComparableProperties", DatabaseSchemas.Valuation);
            e.Property(x => x.ReferenceCode).HasMaxLength(32).IsRequired();
            e.Property(x => x.ComparablePropertyType).HasMaxLength(128).IsRequired();
            e.Property(x => x.Usage).HasMaxLength(64);
            e.Property(x => x.TransactionReference).HasMaxLength(64);
            e.Property(x => x.ReliabilityTag).HasMaxLength(16).IsRequired();
            e.Property(x => x.TagRationale).HasMaxLength(2000);
            e.Property(x => x.TaggedByUserId).HasMaxLength(128);
            e.Property(x => x.TransactionKind).HasMaxLength(16).IsRequired();
            e.Property(x => x.PriceDescription).HasMaxLength(16);
            e.Property(x => x.Source).HasMaxLength(32).IsRequired();
            e.Property(x => x.ListingNumber).HasMaxLength(64);
            e.Property(x => x.AdvertiserPhone).HasMaxLength(32);
            e.Property(x => x.ListingImageFileName).HasMaxLength(512);
            e.Property(x => x.Latitude).HasPrecision(9, 6);
            e.Property(x => x.Longitude).HasPrecision(9, 6);
            e.Property(x => x.AreaSqm).HasPrecision(18, 2);
            e.Property(x => x.Price).HasPrecision(18, 2);
            e.Property(x => x.PricePerSqm).HasPrecision(18, 2);
            e.Property(x => x.City).HasMaxLength(128);
            e.Property(x => x.District).HasMaxLength(128).IsRequired();
            e.Property(x => x.Description).HasMaxLength(2000);
            e.Property(x => x.IntakeChannel).HasMaxLength(16).IsRequired();
            e.Property(x => x.EnteredByUserId).HasMaxLength(128);
            e.Property(x => x.SourceWorkOrderNumber).HasMaxLength(64);
            e.HasIndex(x => x.ReferenceCode).IsUnique();
            e.HasIndex(x => new { x.IsActive, x.District });
            e.HasIndex(x => x.TransactionDate);
            e.HasIndex(x => x.IntakeChannel);
        });

        builder.Entity<ValuationComparableSelection>(e =>
        {
            e.ToTable("ValuationComparableSelections", DatabaseSchemas.Valuation);
            e.Property(x => x.SelectedByUserId).HasMaxLength(128);
            e.Property(x => x.WeightPct).HasPrecision(9, 4);
            e.Property(x => x.WeightOverrideRationale).HasMaxLength(2000);
            e.Property(x => x.AreaAdjustmentMethod).HasMaxLength(32).IsRequired();
            e.HasIndex(x => new { x.ValuationRequestId, x.ComparablePropertyId })
                .IsUnique()
                .HasDatabaseName("IX_ValuationComparableSelections_Request_Comp");
            e.HasIndex(x => x.ValuationRequestId);
            e.HasOne(x => x.ValuationRequest)
                .WithMany()
                .HasForeignKey(x => x.ValuationRequestId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.ComparableProperty)
                .WithMany()
                .HasForeignKey(x => x.ComparablePropertyId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasMany(x => x.AdjustmentLines)
                .WithOne(x => x.Selection!)
                .HasForeignKey(x => x.SelectionId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<ValuationComparableAdjustmentLine>(e =>
        {
            e.ToTable("ValuationComparableAdjustmentLines", DatabaseSchemas.Valuation);
            e.Property(x => x.FactorKey).HasMaxLength(32).IsRequired();
            e.Property(x => x.LabelAr).HasMaxLength(128).IsRequired();
            e.Property(x => x.Percent).HasPrecision(9, 4);
            e.Property(x => x.Rationale).HasMaxLength(2000);
            e.HasIndex(x => x.SelectionId);
        });

        builder.Entity<ValuationMarketApproach>(e =>
        {
            e.ToTable("ValuationMarketApproaches", DatabaseSchemas.Valuation);
            e.Property(x => x.SubjectAreaSqm).HasPrecision(18, 2);
            e.Property(x => x.AdjustmentBasis).HasMaxLength(32).IsRequired();
            e.Property(x => x.AnalysisNotes).HasMaxLength(4000);
            e.HasIndex(x => x.ValuationRequestId).IsUnique();
            e.HasOne(x => x.ValuationRequest)
                .WithMany()
                .HasForeignKey(x => x.ValuationRequestId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<ValuationApproachSettings>(e =>
        {
            e.ToTable("ValuationApproachSettings", DatabaseSchemas.Valuation);
            e.Property(x => x.CostBasisKey).HasMaxLength(32).IsRequired();
            e.Property(x => x.CostMeasurementUnitKey).HasMaxLength(32).IsRequired();
            e.HasIndex(x => x.ValuationRequestId).IsUnique();
            e.HasOne(x => x.ValuationRequest)
                .WithMany()
                .HasForeignKey(x => x.ValuationRequestId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<ValuationCostApproach>(e =>
        {
            e.ToTable("ValuationCostApproaches", DatabaseSchemas.Valuation);
            e.Property(x => x.LandUnitRateFromMarket).HasPrecision(18, 2);
            e.Property(x => x.LandAreaSqm).HasPrecision(18, 2);
            e.Property(x => x.UseRestrictionDiscountPct).HasPrecision(9, 4);
            e.Property(x => x.UseRestrictionRationale).HasMaxLength(2000);
            e.Property(x => x.ApartmentLandShareSqm).HasPrecision(18, 2);
            e.Property(x => x.LandValueFromMarket).HasPrecision(18, 2);
            e.Property(x => x.FinancingAnnualRatePct).HasPrecision(9, 4);
            e.Property(x => x.ActualAgeYears).HasPrecision(9, 2);
            e.Property(x => x.EconomicAgeYears).HasPrecision(9, 2);
            e.Property(x => x.LifeExtensionYears).HasPrecision(9, 2);
            e.Property(x => x.LifeExtensionBasis).HasMaxLength(2000);
            e.Property(x => x.FunctionalObsolescencePct).HasPrecision(9, 4);
            e.Property(x => x.FunctionalObsolescenceRationale).HasMaxLength(2000);
            e.Property(x => x.ExternalObsolescencePct).HasPrecision(9, 4);
            e.Property(x => x.ExternalObsolescenceRationale).HasMaxLength(2000);
            e.Property(x => x.AnalysisNotes).HasMaxLength(4000);
            e.HasIndex(x => x.ValuationRequestId).IsUnique();
            e.HasOne(x => x.ValuationRequest)
                .WithMany()
                .HasForeignKey(x => x.ValuationRequestId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasMany(x => x.Lines)
                .WithOne(x => x.CostApproach!)
                .HasForeignKey(x => x.CostApproachId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasMany(x => x.IndirectItems)
                .WithOne(x => x.CostApproach!)
                .HasForeignKey(x => x.CostApproachId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<ValuationIndirectCostItem>(e =>
        {
            e.ToTable("ValuationIndirectCostItems", DatabaseSchemas.Valuation);
            e.Property(x => x.ItemKey).HasMaxLength(64).IsRequired();
            e.Property(x => x.Pct).HasPrecision(9, 4);
            e.Property(x => x.Rationale).HasMaxLength(2000);
            e.HasIndex(x => x.CostApproachId);
        });

        builder.Entity<ValuationCostLine>(e =>
        {
            e.ToTable("ValuationCostLines", DatabaseSchemas.Valuation);
            e.Property(x => x.StructureKind).HasMaxLength(32).IsRequired();
            e.Property(x => x.ItemKey).HasMaxLength(64).IsRequired();
            e.Property(x => x.Label).HasMaxLength(256).IsRequired();
            e.Property(x => x.AreaSqm).HasPrecision(18, 2);
            e.Property(x => x.Unit).HasMaxLength(16).IsRequired();
            e.Property(x => x.BuildRatioPct).HasPrecision(9, 4);
            e.Property(x => x.UnitCostSar).HasPrecision(18, 2);
            e.Property(x => x.Rationale).HasMaxLength(2000);
            e.HasIndex(x => x.CostApproachId);
        });

        builder.Entity<ValuationReconciliation>(e =>
        {
            e.ToTable("ValuationReconciliations", DatabaseSchemas.Valuation);
            e.Property(x => x.MethodsRationale).HasMaxLength(4000).IsRequired();
            e.Property(x => x.BasisOfValueKey).HasMaxLength(32).IsRequired();
            e.Property(x => x.ValuePremiseKey).HasMaxLength(32);
            e.Property(x => x.LiquidationDiscountPct).HasPrecision(9, 4);
            e.Property(x => x.LiquidationDiscountRationale).HasMaxLength(2000);
            e.Property(x => x.MethodologyAlertOverridesJson);
            e.HasIndex(x => x.ValuationRequestId).IsUnique();
            e.HasOne(x => x.ValuationRequest)
                .WithMany()
                .HasForeignKey(x => x.ValuationRequestId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasMany(x => x.Methods)
                .WithOne(x => x.Reconciliation!)
                .HasForeignKey(x => x.ReconciliationId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        builder.Entity<ValuationReconciliationMethodLine>(e =>
        {
            e.ToTable("ValuationReconciliationMethodLines", DatabaseSchemas.Valuation);
            e.Property(x => x.ApproachKind).HasMaxLength(32).IsRequired();
            e.Property(x => x.ApproachValue).HasPrecision(18, 2);
            e.Property(x => x.WeightPct).HasPrecision(9, 4);
            e.Property(x => x.Rationale).HasMaxLength(2000);
            e.HasIndex(x => x.ReconciliationId);
        });

        builder.HasSequence<int>(
                DatabaseSequences.ValuationRequestDisplayId,
                DatabaseSchemas.Valuation)
            .StartsAt(DatabaseSequences.ValuationRequestDisplayIdStart)
            .IncrementsBy(1);

        return builder;
    }
}
