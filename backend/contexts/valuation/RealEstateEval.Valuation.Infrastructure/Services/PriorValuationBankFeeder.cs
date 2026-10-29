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
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Valuation.Application.Abstractions;
using RealEstateEval.Valuation.Application.Contracts;
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
/// land comparable) — as of today (not retrospective), is a usable market indication. Up to two rows per
/// subject property (2026-10-29): any land valued on its own enters as a land comparable — vacant land by its
/// final value, the land of a built subject by the cost approach's adjusted land rate × the whole plot — and a
/// built subject enters as a building comparable by its final value over its floor area. A newly deposited
/// version updates them; a version that no longer yields a row takes it off the bank. A row another valuation
/// adopted is left untouched — that valuation reads the bank row live and its value must not move.
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

        // Up to two prior-valuation rows per subject property — its land and its building — told apart by
        // type (tracked: a new version updates them).
        var existingRows = await valuation.ComparableProperties
            .Where(c => c.SourcePropertyId == propertyGuid && c.Source == ComparableSources.PriorValuation)
            .OrderByDescending(c => c.UpdatedAtUtc)
            .ToListAsync(cancellationToken);
        var existingLand = existingRows.FirstOrDefault(PriorValuationBankRules.IsLandRow);
        var existingBuilding = existingRows.FirstOrDefault(r => !PriorValuationBankRules.IsLandRow(r));

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
        {
            await RetireAsync(existingLand, valuationRequestId, cancellationToken);
            await RetireAsync(existingBuilding, valuationRequestId, cancellationToken);
            return false;
        }

        if (context.LatestWorkspace?.MapLatitude is not { } lat
            || context.LatestWorkspace.MapLongitude is not { } lon
            || !ComparableProximityRules.HasUsableCoordinates(lat, lon))
        {
            return false;
        }

        var market = await selections.ListAsync(valuationRequestId, cancellationToken);
        var finalValue = recon?.FinalOpinionValue ?? 0m;
        var propertyType = string.IsNullOrWhiteSpace(context.EffectivePropertyType())
            ? vr.PropertyType ?? ""
            : context.EffectivePropertyType();
        var subjectIsLand = CostScopeKeys.IsLandOnly(scope)
            || (ValuationApproachSettingsRules.IsLandPropertyType(propertyType)
                && !PriorValuationBankRules.HasFloorArea(context.BuildingInventoryLines));
        var write = new BankRowWriter(this, valuation, clock, vr, context, lat, lon, valuationRequestId);

        if (subjectIsLand)
        {
            // Land valued on its own: its final value over its land area.
            await RetireAsync(existingBuilding, valuationRequestId, cancellationToken);
            var landArea = PriorValuationBankRules.SubjectAreaSqm(
                propertyType, context.Area, market?.SubjectAreaSqm, subjectIsLand: true);
            return await write.UpsertAsync(
                existingLand,
                PriorValuationBankRules.ComparableType(scope, propertyType),
                landArea,
                finalValue,
                $"قيمة تقييم سابق معتمدة — معاملة {vr.DisplayId}",
                cancellationToken);
        }

        // A built subject (2026-10-29 ruling): the building enters as a building comparable — its value over
        // its floor area (an apartment: its own deed area) — and its land, when the cost approach valued it on
        // its own from land comparables, enters as a land comparable on the whole plot.
        var buildingArea = PriorValuationBankRules.SubjectAreaSqm(
            propertyType, context.Area, market?.SubjectAreaSqm, subjectIsLand: false);
        var fedBuilding = await write.UpsertAsync(
            existingBuilding,
            PriorValuationBankRules.BuildingComparableType(propertyType, context.BuildingInventoryLines),
            buildingArea,
            finalValue,
            $"قيمة تقييم سابق معتمدة — معاملة {vr.DisplayId}",
            cancellationToken);

        var land = settings?.CostApproachEnabled == true
            ? await selections.ListAsync(
                valuationRequestId, ComparableSelectionContexts.LandWithinCost, cancellationToken)
            : null;
        var (landRate, plotArea) = PriorValuationBankRules.LandValuedOnItsOwn(land);
        var fedLand = await write.UpsertAsync(
            existingLand,
            PropertyCategoryRules.LabelAr(PropertyCategoryRules.Land),
            plotArea,
            Math.Round(landRate * plotArea, 2),
            $"قيمة أرض من تقييم سابق معتمد (طريقة المقاول) — معاملة {vr.DisplayId}",
            cancellationToken);
        return fedBuilding || fedLand;
    }

    /// <summary>
    /// Writes one prior-valuation bank row. A row with no usable value or area is taken off the bank; a row
    /// another valuation adopted is never rewritten.
    /// </summary>
    private sealed class BankRowWriter(
        PriorValuationBankFeeder feeder,
        ValuationDbContext db,
        TimeProvider time,
        ValuationRequest vr,
        CaseStudyValuationPropertyContextDto context,
        decimal lat,
        decimal lon,
        Guid valuationRequestId)
    {
        public async Task<bool> UpsertAsync(
            ComparableProperty? existing,
            string comparableType,
            decimal areaSqm,
            decimal price,
            string description,
            CancellationToken cancellationToken)
        {
            if (existing is not null
                && await feeder.AdoptedByAnotherValuationAsync(existing.Id, valuationRequestId, cancellationToken))
            {
                return false;
            }
            if (price <= 0m || areaSqm <= 0m)
                return await feeder.RetireAsync(existing, valuationRequestId, cancellationToken);

            var now = time.GetUtcNow().UtcDateTime;
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
                    SourcePropertyId = vr.PropertyId,
                    EnteredByUserId = "system:prior-valuation-feeder",
                    EnteredAtUtc = now,
                    CreatedAtUtc = now,
                };
                db.ComparableProperties.Add(row);
            }

            row.ComparablePropertyType = comparableType;
            row.Usage = ComparablePropertyRules.UsageOrDefault(null, context.Classification, comparableType);
            row.Latitude = lat;
            row.Longitude = lon;
            row.AreaSqm = areaSqm;
            row.TransactionDate = RiyadhClock.DateOf(now);
            row.Price = price;
            row.PricePerSqm = ComparablePropertyRules.ComputePricePerSqm(price, areaSqm);
            row.City = context.City;
            row.District = context.District;
            row.Description = description;
            row.SourceWorkOrderNumber = context.PoNumber;
            row.IsActive = true;
            row.UpdatedAtUtc = now;
            await db.SaveChangesAsync(cancellationToken);
            return true;
        }
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

    /// <summary>
    /// The new version no longer qualifies (or no longer yields this row): its earlier bank row is taken off
    /// the bank — unless another valuation adopted it, which reads it live.
    /// </summary>
    private async Task<bool> RetireAsync(
        ComparableProperty? existing,
        Guid valuationRequestId,
        CancellationToken cancellationToken)
    {
        if (existing is null || !existing.IsActive) return false;
        if (await AdoptedByAnotherValuationAsync(existing.Id, valuationRequestId, cancellationToken)) return false;
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
    /// unit's 180 m² at 5,388.89). Land keeps the market table's subject area, else the deed area.
    /// A building keeps the market header's area, which is its floor area since 2026-10-29 — the same
    /// measure building comparables are entered with («مسطح البناء»).
    /// Edge cases: a building whose header has no floor area returns 0 (not the deed's land area) and is
    /// not fed.
    /// </summary>
    public static decimal SubjectAreaSqm(
        string? propertyType,
        string? deedArea,
        decimal? marketSubjectAreaSqm,
        bool subjectIsLand = true)
    {
        decimal? deed = LocaleNumber.TryParsePositive(deedArea, out var parsed) ? parsed : null;
        if (IsApartment(propertyType) && deed is { } own) return own;
        if (marketSubjectAreaSqm is > 0m) return marketSubjectAreaSqm.Value;
        return subjectIsLand ? deed ?? 0m : 0m;
    }

    /// <summary>
    /// The specialist's inventory lists a floor area (a floor, an annex or a basement with an area) —
    /// a building stands on the land, not only a fence or a room's fittings.
    /// </summary>
    public static bool HasFloorArea(IEnumerable<CaseStudyBuildingInventoryLineDto>? lines) =>
        (lines ?? []).Any(l =>
            (l.StructureKind ?? "").Trim() is BuildingStructureKinds.Floor
                or BuildingStructureKinds.Annex
                or BuildingStructureKinds.Basement
            && LocaleNumber.TryParsePositive(l.AreaSqm, out _));

    /// <summary>A unit valued on its own — its land is a share of the building plot.</summary>
    public static bool IsApartment(string? propertyType)
    {
        var t = (propertyType ?? "").Trim();
        return t.Contains("شقة", StringComparison.Ordinal)
            || t.Contains("شقه", StringComparison.Ordinal)
            || t.Contains("apartment", StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>A land row of this property (vacant land, land only, or the land of a built subject).</summary>
    public static bool IsLandRow(ComparableProperty row) =>
        ValuationApproachSettingsRules.IsLandPropertyType(row.ComparablePropertyType);

    /// <summary>
    /// The building row's type — what an appraiser searches the bank by.
    /// How it works: the property type (the inspector's «الأصل محل التقييم» when set) when it names a
    /// building. When it names land (أرض تجارية عليها مستودع — the inspector picks «أرض» there), the
    /// building is named from the specialist's inventory: the largest floor line whose name is a building
    /// («المستودع الرئيسي» → «مستودع»). «مبنى» when nothing names it.
    /// Edge cases: a building comparable is never typed as land.
    /// </summary>
    public static string BuildingComparableType(
        string propertyType,
        IEnumerable<CaseStudyBuildingInventoryLineDto>? inventory = null)
    {
        if (!ValuationApproachSettingsRules.IsLandPropertyType(propertyType)
            && !string.IsNullOrWhiteSpace(propertyType))
        {
            return propertyType.Trim();
        }
        var named = (inventory ?? [])
            .Where(l => (l.StructureKind ?? "").Trim() == BuildingStructureKinds.Floor)
            .Select(l => (
                Area: LocaleNumber.TryParsePositive(l.AreaSqm, out var area) ? area : 0m,
                Name: BuildingNameOf(l.Label)))
            .Where(x => x.Name is not null)
            .OrderByDescending(x => x.Area)
            .Select(x => x.Name)
            .FirstOrDefault();
        return named ?? "مبنى";
    }

    private static readonly System.Text.RegularExpressions.Regex BuildingNameWord = new(
        @"^(?:مساح[ةه] )?(?:ال)?(محل|مكتب|معرض|مستودع|هنجر|ورش[ةه]|مصنع)(?:\s|$)",
        System.Text.RegularExpressions.RegexOptions.CultureInvariant);

    /// <summary>«المستودع الرئيسي» / «مساحة المعرض» → «مستودع» / «معرض»; null when the name is not a building.</summary>
    private static string? BuildingNameOf(string? label)
    {
        var match = BuildingNameWord.Match((label ?? "").Trim());
        return match.Success ? match.Groups[1].Value.Replace("ورشه", "ورشة") : null;
    }

    /// <summary>
    /// The land the cost approach valued on its own: the adjusted land rate of the land table and the whole
    /// plot it compares with (an apartment's land too — on the building plot, never its share). (0, 0) when
    /// no land comparable was adopted or the plot is unknown.
    /// </summary>
    public static (decimal Rate, decimal PlotArea) LandValuedOnItsOwn(ValuationComparableSelectionListDto? land)
    {
        if (land is null || !land.Items.Any(i => i.IsAdopted)) return (0m, 0m);
        var rate = land.WeightedPricePerSqm;
        var plot = land.SubjectAreaSqm ?? 0m;
        return rate > 0m && plot > 0m ? (rate, plot) : (0m, 0m);
    }

    /// <summary>A land-only valuation enters the bank as a LAND comparable («أرض»).</summary>
    public static string ComparableType(string? costScopeKey, string propertyType) =>
        CostScopeKeys.IsLandOnly(costScopeKey)
            ? PropertyCategoryRules.LabelAr(PropertyCategoryRules.Land)
            : propertyType;
}
