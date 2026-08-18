using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Infrastructure.Services;

/// <summary>
/// Harvests a completed valuation's subject into the shared bank as source
/// «تقييم سابق» — the source card then shows «من معاملات سابقة».
/// Skips quietly when mandatory bank data (final value, area, coordinates) is absent:
/// «لا تُخترع بيانات».
/// </summary>
public sealed class PriorValuationBankFeeder(
    ValuationDbContext valuation,
    ICaseStudyLookup caseStudy,
    IValuationReconciliationService reconciliation,
    IValuationComparableSelectionService selections,
    TimeProvider clock) : IPriorValuationBankFeeder
{
    public async Task<bool> FeedAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken = default)
    {
        var vr = await valuation.ValuationRequests.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == valuationRequestId, cancellationToken);
        if (vr is null) return false;
        if (!Guid.TryParse(vr.PropertyId?.Trim(), out var propertyGuid)) return false;

 // Idempotent — one prior-valuation row per subject property.
        var exists = await valuation.ComparableProperties.AsNoTracking()
            .AnyAsync(
                c => c.SourcePropertyId == propertyGuid
                    && c.Source == ComparableSources.PriorValuation,
                cancellationToken);
        if (exists) return false;

        var recon = await reconciliation.GetAsync(valuationRequestId, cancellationToken);
        var market = await selections.ListAsync(valuationRequestId, cancellationToken);
        var finalValue = recon?.FinalOpinionValue ?? 0m;
        var areaSqm = market?.SubjectAreaSqm ?? 0m;
        if (finalValue <= 0m || areaSqm <= 0m) return false;

        var context = await caseStudy.GetValuationPropertyContextAsync(
            propertyGuid,
            cancellationToken);
        if (context is null) return false;

        if (context.LatestWorkspace?.MapLatitude is not { } lat
            || context.LatestWorkspace.MapLongitude is not { } lon
            || !ComparableProximityRules.HasUsableCoordinates(lat, lon))
        {
            return false;
        }

        var poNumber = context.PoNumber;

        var now = clock.GetUtcNow().UtcDateTime;
        var id = Guid.NewGuid();
        valuation.ComparableProperties.Add(new ComparableProperty
        {
            Id = id,
            ReferenceCode = $"CMP-{id.ToString("N")[..8].ToUpperInvariant()}",
            ComparablePropertyType = string.IsNullOrWhiteSpace(context.PropertyType)
                ? vr.PropertyType ?? ""
                : context.PropertyType,
            TransactionKind = ComparableTransactionKinds.Executed,
            Source = ComparableSources.PriorValuation,
            Latitude = lat,
            Longitude = lon,
            AreaSqm = areaSqm,
            TransactionDate = DateOnly.FromDateTime(now),
            Price = finalValue,
            PricePerSqm = ComparablePropertyRules.ComputePricePerSqm(finalValue, areaSqm),
            City = context.City,
            District = context.District,
            Description = $"قيمة تقييم سابق معتمدة — معاملة {vr.DisplayId}",
            IntakeChannel = ComparableIntakeChannels.Office,
            SourceWorkOrderNumber = poNumber,
            SourcePropertyId = propertyGuid,
            EnteredByUserId = "system:prior-valuation-feeder",
            EnteredAtUtc = now,
            IsActive = true,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        });
        await valuation.SaveChangesAsync(cancellationToken);
        return true;
    }
}
