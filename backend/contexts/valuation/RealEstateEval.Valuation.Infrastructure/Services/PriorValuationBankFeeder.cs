// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 1 (5b554f4e)
//  • Only a market-basis valuation of land with its buildings, not retrospective, feeds the bank
//         (PriorValuationBankRules.Qualifies).
//  • One row per subject property: a new deposited version updates the existing row instead of being
//         skipped; a version that no longer qualifies deactivates it (RetireAsync).
//  • A row another valuation has adopted is left untouched (AdoptedByAnotherValuationAsync) — that
//         valuation reads it live and its value must not move.
// Round 2 (1b19bedc)
//  • C    Land-only valuations (scope «أرض فقط» / vacant land) also qualify and enter the bank as a land
//         comparable «أرض» (ComparableType); the row's Usage is set from the classification.
//  • Area  An apartment enters with its own deed area, not the building plot held in the market header
//          (SubjectAreaSqm; VR-542 entered 900 m² instead of 180 m²).
// ──────────────────────────────────────────────────────────────────────────────────────────────

using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Valuation.Application.Abstractions;
using RealEstateEval.Valuation.Infrastructure.Data.Contexts;
using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Valuation.Infrastructure.Services;

/// <summary>
/// Harvests a completed valuation's subject into the shared bank as source
/// "Prior valuation" — the source card then shows "from prior transactions".
/// Skips quietly when mandatory bank data (final value, area, coordinates) is absent:
/// "Do not invent data".
/// <para>
/// Only a market-value opinion on land with its buildings — or on land alone (entered as a
/// land comparable) — as of today (not retrospective), is a usable market indication. One row per subject property: a newly deposited version updates it; a version
/// that no longer qualifies takes it off the bank. A row another valuation adopted is left untouched — that
/// valuation reads the bank row live and its value must not move.
/// </para>
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
        var propertyGuid = vr.PropertyId;

        // One prior-valuation row per subject property (tracked — a new version updates it).
        var existing = await valuation.ComparableProperties
            .Where(c => c.SourcePropertyId == propertyGuid && c.Source == ComparableSources.PriorValuation)
            .OrderByDescending(c => c.UpdatedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);
        if (existing is not null && await AdoptedByAnotherValuationAsync(existing.Id, valuationRequestId, cancellationToken))
            return false;

        var context = await caseStudy.GetValuationPropertyContextAsync(
            propertyGuid,
            cancellationToken);
        if (context is null) return false;

        var recon = await reconciliation.GetAsync(valuationRequestId, cancellationToken);
        var settings = await valuation.ValuationApproachSettings.AsNoTracking()
            .FirstOrDefaultAsync(x => x.ValuationRequestId == valuationRequestId, cancellationToken);
        var scope = settings?.CostScopeKey
            ?? ValuationApproachSettingsRules.DefaultScope(context.EffectivePropertyType(), context.HasStructures());
        if (!PriorValuationBankRules.Qualifies(recon?.BasisOfValueKey, scope, settings?.ValuationDateMode))
            return await RetireAsync(existing, cancellationToken);

        var market = await selections.ListAsync(valuationRequestId, cancellationToken);
        var finalValue = recon?.FinalOpinionValue ?? 0m;
        var propertyType = string.IsNullOrWhiteSpace(context.EffectivePropertyType())
            ? vr.PropertyType ?? ""
            : context.EffectivePropertyType();
        // The subject's own figures: an apartment enters with its own area — never the building plot.
        var areaSqm = PriorValuationBankRules.SubjectAreaSqm(propertyType, context.Area, market?.SubjectAreaSqm);
        if (finalValue <= 0m || areaSqm <= 0m) return false;

        if (context.LatestWorkspace?.MapLatitude is not { } lat
            || context.LatestWorkspace.MapLongitude is not { } lon
            || !ComparableProximityRules.HasUsableCoordinates(lat, lon))
        {
            return false;
        }

        var now = clock.GetUtcNow().UtcDateTime;
        var row = existing;
        if (row is null)
        {
            var id = Guid.NewGuid();
            row = new ComparableProperty
            {
                Id = id,
                ReferenceCode = $"CMP-{id.ToString("N")[..8].ToUpperInvariant()}",
                TransactionKind = ComparableTransactionKinds.Executed,
                Source = ComparableSources.PriorValuation,
                IntakeChannel = ComparableIntakeChannels.Office,
                SourcePropertyId = propertyGuid,
                EnteredByUserId = "system:prior-valuation-feeder",
                EnteredAtUtc = now,
                CreatedAtUtc = now,
            };
            valuation.ComparableProperties.Add(row);
        }

        row.ComparablePropertyType = PriorValuationBankRules.ComparableType(scope, propertyType);
        row.Usage = ComparablePropertyRules.UsageOrDefault(null, context.Classification, row.ComparablePropertyType);
        row.Latitude = lat;
        row.Longitude = lon;
        row.AreaSqm = areaSqm;
        row.TransactionDate = RiyadhClock.DateOf(now);
        row.Price = finalValue;
        row.PricePerSqm = ComparablePropertyRules.ComputePricePerSqm(finalValue, areaSqm);
        row.City = context.City;
        row.District = context.District;
        row.Description = $"قيمة تقييم سابق معتمدة — معاملة {vr.DisplayId}";
        row.SourceWorkOrderNumber = context.PoNumber;
        row.IsActive = true;
        row.UpdatedAtUtc = now;
        await valuation.SaveChangesAsync(cancellationToken);
        return true;
    }

    /// <summary>A valuation other than the source has the row in its adopted comparables.</summary>
    private Task<bool> AdoptedByAnotherValuationAsync(
        Guid comparableId,
        Guid sourceRequestId,
        CancellationToken cancellationToken) =>
        valuation.ValuationComparableSelections.AsNoTracking()
            .AnyAsync(
                s => s.ComparablePropertyId == comparableId
                    && s.IsAdopted
                    && s.ValuationRequestId != sourceRequestId,
                cancellationToken);

    /// <summary>The new version no longer qualifies: its earlier bank row is taken off the bank.</summary>
    private async Task<bool> RetireAsync(ComparableProperty? existing, CancellationToken cancellationToken)
    {
        if (existing is null || !existing.IsActive) return false;
        existing.IsActive = false;
        existing.UpdatedAtUtc = clock.GetUtcNow().UtcDateTime;
        await valuation.SaveChangesAsync(cancellationToken);
        return false;
    }
}

/// <summary>Which completed valuations feed the comparables bank, and as what.</summary>
public static class PriorValuationBankRules
{
    /// <summary>
    /// Market basis, valued as of issue (not a retrospective date), on land with its buildings — or, by
    /// On land alone («أرض فقط» / vacant land). A buildings-only value never feeds the bank.
    /// </summary>
    public static bool Qualifies(string? basisOfValueKey, string? costScopeKey, string? valuationDateMode) =>
        string.Equals((basisOfValueKey ?? "").Trim(), BasisOfValueKeys.Market, StringComparison.OrdinalIgnoreCase)
        && CostScopeKeys.Normalize(costScopeKey) is CostScopeKeys.LandAndBuilding or CostScopeKeys.LandOnly
        && (costScopeKey ?? "").Trim().Length > 0
        && ValuationDateModes.Normalize(valuationDateMode) != ValuationDateModes.Retrospective;

    /// <summary>
    /// The area the bank row carries (its rate = final value ÷ this area). An apartment's own (deed) area —
    /// the market header may have held the whole building plot (VR-542: 900 m² at 1,077.78 instead of the
    /// unit's 180 m² at 5,388.89). Anything else keeps the market table's subject area (for land alone, the
    /// land area); the deed area when the header has none.
    /// </summary>
    public static decimal SubjectAreaSqm(string? propertyType, string? deedArea, decimal? marketSubjectAreaSqm)
    {
        decimal? deed = LocaleNumber.TryParsePositive(deedArea, out var parsed) ? parsed : null;
        if (IsApartment(propertyType) && deed is { } own) return own;
        return marketSubjectAreaSqm is > 0m ? marketSubjectAreaSqm.Value : deed ?? 0m;
    }

    /// <summary>A unit valued on its own — its land is a share of the building plot.</summary>
    public static bool IsApartment(string? propertyType)
    {
        var t = (propertyType ?? "").Trim();
        return t.Contains("شقة", StringComparison.Ordinal)
            || t.Contains("شقه", StringComparison.Ordinal)
            || t.Contains("apartment", StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>A land-only valuation enters the bank as a LAND comparable («أرض»).</summary>
    public static string ComparableType(string? costScopeKey, string propertyType) =>
        CostScopeKeys.IsLandOnly(costScopeKey)
            ? PropertyCategoryRules.LabelAr(PropertyCategoryRules.Land)
            : propertyType;
}
