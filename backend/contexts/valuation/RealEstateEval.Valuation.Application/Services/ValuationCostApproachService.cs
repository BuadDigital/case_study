using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Domain;
using RealEstateEval.Valuation.Application.Abstractions;
using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Application.Rules;
using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Valuation.Application.Services;

/// <summary>
/// Contractor cost approach scaffold — land from market, lines priced by the appraiser.
/// Persistence goes through <see cref="IValuationCostApproachRepository"/> and the ق-6 freeze
/// through <see cref="IValuationReportFreezeGate"/>, so this file holds rules only - no EF
/// (solid-scorecard finding 1).
/// </summary>
public sealed class ValuationCostApproachService(
    IValuationCostApproachRepository repo,
    IValuationReportFreezeGate freeze,
    ICaseStudyLookup caseStudy,
    IValuationComparableSelectionService selections,
    TimeProvider? time = null) : IValuationCostApproachService
{
    private readonly TimeProvider _time = time ?? TimeProvider.System;

    public async Task<ValuationCostApproachDto?> GetAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken = default)
    {
        var vr = await repo.GetRequestAsync(valuationRequestId, cancellationToken);
        if (vr is null) return null;

        var entity = await repo.GetWithItemsAsync(valuationRequestId, cancellationToken);
        var settings = await repo.GetApproachSettingsAsync(valuationRequestId, cancellationToken);
        var scopeKey = CostScopeKeys.Normalize(settings?.CostScopeKey);
        var land = await ReadLandAsync(vr, entity, scopeKey, cancellationToken);

        return ToDto(vr, entity, scopeKey, land, CostLeaseTerms.RemainingLeaseYears(settings));
    }

    /// <summary>The land inputs one read uses: unit rate (SAR/m²), land area and whether comps are adopted.</summary>
    private readonly record struct CostLandInputs(decimal UnitRate, decimal AreaSqm, bool HasAdopted);

    private static CostLandInputs StoredLand(ValuationCostApproach? entity) =>
        new(entity?.LandUnitRateFromMarket ?? 0m,
            entity?.LandAreaSqm ?? 0m,
            entity?.LandImportedAtUtc is not null);

    /// <summary>D7: land inside the cost approach — always a per-m² rate from the adopted land comps.</summary>
    private static CostLandInputs LandFromComps(ValuationComparableSelectionListDto? comps)
    {
        if (comps is null) return new(0m, 0m, false);
        var adopted = comps.Items
            .Where(i => i.IsAdopted && i.Market is not null)
            .Select(i => (i.Market!.PricePerSqmAfterDifference, i.EffectiveAreaSqm, i.Market.EffectiveWeightPct));
        return new(
            CostApproachRules.LandUnitRateFromAdoptedComps(adopted, comps.AdjustmentBasis),
            Math.Max(0m, comps.SubjectAreaSqm ?? 0m),
            comps.AdoptedCount > 0);
    }

    /// <summary>
    /// Problem 21: the land follows the land table live — adopting or adjusting a land comparable
    /// shows in the cost screen, the reconciliation and the gates without a cost save (the market
    /// approach reads its table the same way). After hand-over the table itself is frozen, so the
    /// read cannot drift; the stored columns are the snapshot of the last save. Building-only
    /// scopes carry no land and keep the stored values.
    /// </summary>
    private async Task<CostLandInputs> ReadLandAsync(
        ValuationRequest vr,
        ValuationCostApproach? entity,
        string scopeKey,
        CancellationToken cancellationToken)
    {
        if (CostScopeKeys.IsBuildingOnly(scopeKey)) return StoredLand(entity);
        var comps = await selections.ListAsync(
            vr.Id,
            ComparableSelectionContexts.LandWithinCost,
            cancellationToken);
        return LandFromComps(comps);
    }

    public async Task<(ValuationCostApproachDto? Result, Dictionary<string, string>? Errors)> SaveAsync(
        Guid valuationRequestId,
        SaveValuationCostApproachRequest request,
        CancellationToken cancellationToken = default)
    {
        var vr = await repo.GetRequestAsync(valuationRequestId, cancellationToken);
        if (vr is null)
            return (null, new Dictionary<string, string> { ["_"] = "طلب التقييم غير موجود" });
        var blocked = await freeze.GetWriteBlockedMessageAsync(vr, "طلب التقييم مكتمل", cancellationToken);
        if (blocked is not null)
            return (null, new Dictionary<string, string> { ["_"] = blocked });

 // Q-2/Q-3 amended: cost tab is closed when the approach is off (bare land defaults it off;
 // land WITH structures opens it for the structure lines only — spec v2 §3).
        var approachSettings = await repo.GetApproachSettingsAsync(
            valuationRequestId, cancellationToken);
        var (hasStructures, effectivePropertyType) = await ValuationPropertyScope.ReadAsync(
            caseStudy, vr, cancellationToken);

        // Unsaved settings follow the defaults used everywhere else, not «cost on».
        var settings = approachSettings
            ?? ValuationApproachSettingsRules.Defaults(valuationRequestId, effectivePropertyType, hasStructures);
        var scopeKey = settings.CostScopeKey
            ?? ValuationApproachSettingsRules.DefaultScope(effectivePropertyType, hasStructures);
        var costAllowed = ValuationApproachSettingsRules.CostApproachApplies(
            effectivePropertyType,
            hasStructures,
            scopeKey);
        var costEnabled = costAllowed && settings.CostApproachEnabled;
        if (!costEnabled)
        {
            return (null, new Dictionary<string, string>
            {
                ["_"] = CostScopeKeys.IsLandOnly(scopeKey)
                    ? "نطاق التقييم «أرض فقط» — أسلوب التكلفة لا ينطبق"
                    : !ValuationApproachSettingsRules.CanEnableCostApproach(
                        effectivePropertyType,
                        hasStructures)
                        ? "ق-3: أرض بلا إنشاءات لا تُقيَّم بالتكلفة — أسلوب التكلفة لا ينطبق"
                        : "أسلوب التكلفة غير مفعَّل في إعدادات التقييم (شاشة 1)",
            });
        }

        var lines = request.Lines ?? [];
        var indirectItems = request.IndirectItems ?? [];
        var errors = ValuationCostApproachRequestRules.Validate(request);
        if (errors.Count > 0) return (null, errors);

        var entity = await repo.FindWithItemsAsync(valuationRequestId, cancellationToken);

        // A line id that is not one of this valuation's lines must not belong to another
        // valuation — inserting it would collide with that row (was a 500).
        var unknownIds = ValuationCostApproachRequestRules.UnknownLineIds(
            lines,
            (entity?.Lines ?? []).Select(l => l.Id).ToHashSet());
        if (unknownIds.Count > 0)
        {
            var foreign = await repo.FindLineIdsOwnedElsewhereAsync(
                entity?.Id,
                unknownIds.Select(x => x.Id).ToList(),
                cancellationToken);
            foreach (var (index, id) in unknownIds.Where(x => foreign.Contains(x.Id)))
                errors[$"lines[{index}].id"] = "معرّف البند يخص تقييمًا آخر — أعد تحميل الشاشة ثم احفظ";
            if (errors.Count > 0) return (null, errors);
        }

        if (entity is null)
        {
            entity = new ValuationCostApproach
            {
                Id = Guid.NewGuid(),
                ValuationRequestId = valuationRequestId,
            };
            await repo.AddAsync(entity, cancellationToken);
        }

        entity.UseRestrictionDiscountPct = request.UseRestrictionDiscountPct;
        entity.UseRestrictionRationale = string.IsNullOrWhiteSpace(request.UseRestrictionRationale)
            ? null
            : request.UseRestrictionRationale.Trim();
        entity.ApartmentLandShareSqm = request.ApartmentLandShareSqm;
        // Decision A: the land table's own area — the subject-area sync of the market header never touches it.
        entity.BuildingPlotAreaSqm = request.BuildingPlotAreaSqm;

        // Upsert in place — navigation-adds with pre-set GUIDs get marked Modified
        // by EF's graph heuristic (UPDATE 0 rows → global 409) on re-saves.
        var linesById = entity.Lines.ToDictionary(l => l.Id);
        var keepLines = new HashSet<Guid>();

        // repeated-floors quantity derives from the first-floor area × count.
        var firstFloorArea = ValuationCostApproachRequestRules.FirstFloorArea(lines);

        for (var i = 0; i < lines.Count; i++)
        {
            var line = lines[i];
            var itemKey = CostLineItemKeys.Normalize(line.ItemKey);
            var quantity = line.AreaSqm;
            if (itemKey == CostLineItemKeys.RepeatedFloors)
                quantity = RepeatedFloorRules.QuantityForLine(firstFloorArea, line.RepeatedFloorCount);

            var lineId = line.Id is { } id && id != Guid.Empty ? id : Guid.NewGuid();
            var structureKind = string.IsNullOrWhiteSpace(line.StructureKind)
                ? BuildingStructureKinds.Other
                : line.StructureKind.Trim();
            var label = string.IsNullOrWhiteSpace(line.Label)
                ? CostLineItemKeys.LabelAr(itemKey)
                : line.Label.Trim();
            var unit = CostLineUnits.Normalize(line.Unit ?? CostLineItemKeys.DefaultUnit(itemKey));
            var sortOrder = line.SortOrder != 0 ? line.SortOrder : i;

            if (linesById.TryGetValue(lineId, out var row))
            {
                row.SourceInventoryLineId = line.SourceInventoryLineId;
                row.StructureKind = structureKind;
                row.ItemKey = itemKey;
                row.Label = label;
                row.AreaSqm = quantity;
                row.Unit = unit;
                row.BuildRatioPct = line.BuildRatioPct;
                row.RepeatedFloorCount = line.RepeatedFloorCount;
                row.UnitCostSar = line.UnitCostSar;
                row.Rationale = line.Rationale?.Trim() ?? "";
                row.IsIncluded = line.IsIncluded;
                row.SortOrder = sortOrder;
            }
            else
            {
                await repo.AddLineAsync(new ValuationCostLine
                {
                    Id = lineId,
                    CostApproachId = entity.Id,
                    SourceInventoryLineId = line.SourceInventoryLineId,
                    StructureKind = structureKind,
                    ItemKey = itemKey,
                    Label = label,
                    AreaSqm = quantity,
                    Unit = unit,
                    BuildRatioPct = line.BuildRatioPct,
                    RepeatedFloorCount = line.RepeatedFloorCount,
                    UnitCostSar = line.UnitCostSar,
                    Rationale = line.Rationale?.Trim() ?? "",
                    IsIncluded = line.IsIncluded,
                    SortOrder = sortOrder,
                },
                cancellationToken);
            }
            keepLines.Add(lineId);
        }
        await repo.RemoveLinesAsync(
            entity.Lines.Where(l => !keepLines.Contains(l.Id)).ToList(),
            cancellationToken);

        var indirectByKey = entity.IndirectItems.ToDictionary(x => x.ItemKey);
        var keepIndirect = new HashSet<string>();
        for (var i = 0; i < indirectItems.Count; i++)
        {
            var item = indirectItems[i];
            var sortOrder = item.SortOrder != 0 ? item.SortOrder : i;
            var rationale = string.IsNullOrWhiteSpace(item.Rationale) ? null : item.Rationale.Trim();
            if (indirectByKey.TryGetValue(item.ItemKey, out var row))
            {
                row.Pct = item.Pct;
                row.Rationale = rationale;
                row.SortOrder = sortOrder;
            }
            else
            {
                await repo.AddIndirectItemAsync(
                    new ValuationIndirectCostItem
                    {
                        Id = Guid.NewGuid(),
                        CostApproachId = entity.Id,
                        ItemKey = item.ItemKey,
                        Pct = item.Pct,
                        Rationale = rationale,
                        SortOrder = sortOrder,
                    },
                    cancellationToken);
            }
            keepIndirect.Add(item.ItemKey);
        }
        await repo.RemoveIndirectItemsAsync(
            entity.IndirectItems.Where(x => !keepIndirect.Contains(x.ItemKey)).ToList(),
            cancellationToken);

        entity.FinancingAnnualRatePct = request.FinancingAnnualRatePct;
        entity.FinancingMonths = request.FinancingMonths;
        entity.ActualAgeYears = request.ActualAgeYears;
        entity.ActualAgeRationale = TrimOrNull(request.ActualAgeRationale);
        entity.EconomicAgeYears = request.EconomicAgeYears;
        entity.EconomicAgeRationale = TrimOrNull(request.EconomicAgeRationale);
        entity.LifeExtensionYears = request.LifeExtensionYears;
        entity.LifeExtensionBasis = string.IsNullOrWhiteSpace(request.LifeExtensionBasis)
            ? null
            : request.LifeExtensionBasis.Trim();
        entity.FunctionalObsolescencePct = request.FunctionalObsolescencePct;
        entity.FunctionalObsolescenceRationale = string.IsNullOrWhiteSpace(request.FunctionalObsolescenceRationale)
            ? null
            : request.FunctionalObsolescenceRationale.Trim();
        entity.ExternalObsolescencePct = request.ExternalObsolescencePct;
        entity.ExternalObsolescenceRationale = string.IsNullOrWhiteSpace(request.ExternalObsolescenceRationale)
            ? null
            : request.ExternalObsolescenceRationale.Trim();

        entity.AnalysisNotes = string.IsNullOrWhiteSpace(request.AnalysisNotes)
            ? null
            : request.AnalysisNotes.Trim();
        entity.UpdatedAtUtc = _time.UtcNow();
        await repo.SaveChangesAsync(cancellationToken);

        // The land table reads the plot and the share from the stored row (decision A), so the land
        // snapshot is taken once they are saved — a changed plot moves the area adjustment.
        await RefreshLandSnapshotAsync(entity, request.RefreshLandFromLandComps, cancellationToken);
        await repo.SaveChangesAsync(cancellationToken);

        return (await GetAsync(valuationRequestId, cancellationToken), null);
    }

    /// <summary>Stored land snapshot: rate and plot from the land table, value = discounted rate × (share ?? plot).</summary>
    private async Task RefreshLandSnapshotAsync(
        ValuationCostApproach entity,
        bool refreshFromLandComps,
        CancellationToken cancellationToken)
    {
        if (refreshFromLandComps)
        {
            // Cost land comes from the land_within_cost table only — no import from the market approach.
            var land = LandFromComps(await selections.ListAsync(
                entity.ValuationRequestId,
                ComparableSelectionContexts.LandWithinCost,
                cancellationToken));
            entity.LandUnitRateFromMarket = land.UnitRate;
            entity.LandAreaSqm = land.AreaSqm;
            entity.LandImportedAtUtc = land.HasAdopted ? _time.UtcNow() : null;
        }

        entity.LandValueFromMarket = CostApproachRules.LandValue(
            CostApproachRules.LandUnitRateAfterDiscount(
                entity.LandUnitRateFromMarket, entity.UseRestrictionDiscountPct),
            entity.LandAreaSqm,
            entity.ApartmentLandShareSqm);
    }

    private static string? TrimOrNull(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static ValuationCostApproachDto ToDto(
        ValuationRequest vr,
        ValuationCostApproach? entity,
        string costScopeKey,
        CostLandInputs landInputs,
        decimal? remainingLeaseYears)
    {
        var orderedLines = (entity?.Lines ?? []).OrderBy(l => l.SortOrder).ToList();

        // Interactive model spec: repeating-floor line inherits "first floor" m² rate when left empty.
        var firstFloorUnitCost = orderedLines
            .Where(l => CostLineItemKeys.Normalize(l.ItemKey) == CostLineItemKeys.FirstFloor)
            .Select(l => l.UnitCostSar)
            .FirstOrDefault();

        var computed = orderedLines
            .Select(l =>
            {
                var effectiveUnitCost = CostApproachRules.InheritedUnitCost(
                    l.ItemKey, l.UnitCostSar, firstFloorUnitCost);
                var effectiveQty = CostApproachRules.EffectiveQuantity(
                    l.AreaSqm, l.Unit, l.BuildRatioPct, l.ItemKey, l.StructureKind);
                return (Line: l,
                    EffectiveUnitCost: effectiveUnitCost,
                    Inherited: effectiveUnitCost != Math.Max(0m, l.UnitCostSar),
                    EffectiveQty: effectiveQty,
                    Total: CostApproachRules.LineTotal(effectiveQty, effectiveUnitCost));
            })
            .ToList();

        var direct = computed.Where(c => c.Line.IsIncluded).Sum(c => c.Total);
        var rateAfterDiscount = CostApproachRules.LandUnitRateAfterDiscount(
            landInputs.UnitRate,
            entity?.UseRestrictionDiscountPct ?? 0m);
        var land = CostApproachRules.LandValue(
            rateAfterDiscount,
            landInputs.AreaSqm,
            entity?.ApartmentLandShareSqm);
        var landEstimateComplete = landInputs.UnitRate > 0m && landInputs.AreaSqm > 0m;

 // chain (–)
        var financingPct = CostApproachRules.FinancingPct(
            entity?.FinancingAnnualRatePct ?? 0m,
            entity?.FinancingMonths ?? 0);
        var indirectItems = (entity?.IndirectItems ?? [])
            .OrderBy(i => i.SortOrder)
            .Select(i => new ValuationIndirectCostItemDto
            {
                ItemKey = i.ItemKey,
                LabelAr = IndirectCostItemKeys.LabelAr(i.ItemKey),
                Pct = i.Pct,
                Rationale = i.Rationale,
                Amount = CostApproachRules.IndirectItemAmount(direct, i.Pct),
                SortOrder = i.SortOrder,
            })
            .ToList();
        var indirectSum = CostApproachRules.IndirectSumPct(
            indirectItems.Select(i => i.Pct), financingPct);
        var totalCost = CostApproachRules.TotalCostWithIndirect(direct, indirectSum);

        var lines = computed
            .Select(c => new ValuationCostLineDto
            {
                Id = c.Line.Id,
                SourceInventoryLineId = c.Line.SourceInventoryLineId,
                StructureKind = c.Line.StructureKind,
                ItemKey = c.Line.ItemKey,
                ItemLabelAr = CostLineItemKeys.LabelAr(c.Line.ItemKey),
                Label = c.Line.Label,
                AreaSqm = c.Line.AreaSqm,
                Unit = c.Line.Unit,
                UnitLabelAr = CostLineUnits.LabelAr(c.Line.Unit),
                BuildRatioPct = c.Line.BuildRatioPct,
                RepeatedFloorCount = c.Line.RepeatedFloorCount,
                UnitCostSar = c.Line.UnitCostSar,
                EffectiveUnitCostSar = c.EffectiveUnitCost,
                UnitCostInherited = c.Inherited,
                EffectiveQuantity = c.EffectiveQty,
                LineTotal = c.Total,
                NetUnitRateWithIndirect = CostApproachRules.NetUnitRateWithIndirect(
                    c.Total, c.EffectiveQty, indirectSum),
                Rationale = c.Line.Rationale,
                IsIncluded = c.Line.IsIncluded,
                SortOrder = c.Line.SortOrder,
            })
            .ToList();

        // Building floor areas: Σ effective quantity of m² lines in the floor-areas group
        // (including custom lines placed in the group via structureKind = floor).
        var buildingArea = computed
            .Where(c => c.Line.IsIncluded
                && CostLineUnits.Normalize(c.Line.Unit) == CostLineUnits.Sqm
                && (CostLineItemKeys.Group1.Contains(CostLineItemKeys.Normalize(c.Line.ItemKey))
                    || (CostLineItemKeys.Normalize(c.Line.ItemKey) == CostLineItemKeys.Custom
                        && string.Equals(
                            c.Line.StructureKind,
                            BuildingStructureKinds.Floor,
                            StringComparison.OrdinalIgnoreCase))))
            .Sum(c => c.EffectiveQty);

 // chain (–)
        var extendedLife = CostApproachRules.ExtendedLifeYears(
            entity?.EconomicAgeYears, entity?.LifeExtensionYears ?? 0m);
        // D11: building-only on leased land — the remaining life cannot outlast the lease.
        var effectiveLife = CostApproachRules.LifeCappedByLease(
            extendedLife, entity?.ActualAgeYears, remainingLeaseYears);
        var physicalPct = CostApproachRules.PhysicalObsolescencePct(
            entity?.ActualAgeYears, effectiveLife);
        var totalObsolescence = CostApproachRules.TotalObsolescencePct(
            physicalPct,
            entity?.FunctionalObsolescencePct ?? 0m,
            entity?.ExternalObsolescencePct ?? 0m);
        var depreciation = CostApproachRules.DepreciationValue(totalCost, totalObsolescence);
        var buildingsAfterDep = CostApproachRules.BuildingsAfterDepreciation(totalCost, depreciation);

        return new ValuationCostApproachDto
        {
            ValuationRequestId = vr.Id,
            PropertyId = vr.PropertyId.ToString("D"),
            IsSaved = entity is not null,
            LandUnitRateFromMarket = landInputs.UnitRate,
            LandAreaSqm = landInputs.AreaSqm,
            LandEstimateComplete = landEstimateComplete,
            UseRestrictionDiscountPct = entity?.UseRestrictionDiscountPct ?? 0m,
            UseRestrictionRationale = entity?.UseRestrictionRationale,
            ApartmentLandShareSqm = entity?.ApartmentLandShareSqm,
            BuildingPlotAreaSqm = entity?.BuildingPlotAreaSqm,
            LandUnitRateAfterDiscount = rateAfterDiscount,
            LandValueFromMarket = land,
            LandImportedAtUtc = entity?.LandImportedAtUtc?.ToString("o"),
            DirectCostTotal = direct,
            IndirectItems = indirectItems,
            FinancingAnnualRatePct = entity?.FinancingAnnualRatePct ?? 0m,
            FinancingMonths = entity?.FinancingMonths ?? 0,
            FinancingPct = financingPct,
            IndirectRatesSumPct = indirectSum,
            TotalCostWithIndirect = totalCost,
            ActualAgeYears = entity?.ActualAgeYears,
            ActualAgeRationale = entity?.ActualAgeRationale,
            EconomicAgeYears = entity?.EconomicAgeYears,
            EconomicAgeRationale = entity?.EconomicAgeRationale,
            LifeExtensionYears = entity?.LifeExtensionYears ?? 0m,
            LifeExtensionBasis = entity?.LifeExtensionBasis,
            FunctionalObsolescencePct = entity?.FunctionalObsolescencePct ?? 0m,
            FunctionalObsolescenceRationale = entity?.FunctionalObsolescenceRationale,
            ExternalObsolescencePct = entity?.ExternalObsolescencePct ?? 0m,
            ExternalObsolescenceRationale = entity?.ExternalObsolescenceRationale,
            ExtendedLifeYears = extendedLife,
            RemainingLeaseYears = remainingLeaseYears,
            LifeCappedByLease = effectiveLife < extendedLife,
            EffectiveLifeYears = effectiveLife,
            PhysicalObsolescencePct = physicalPct,
            TotalObsolescencePct = totalObsolescence,
            AppliedObsolescencePct = CostApproachRules.AppliedObsolescencePct(totalObsolescence),
            ObsolescenceNeedsAlert = CostApproachRules.ObsolescenceNeedsAlert(totalObsolescence),
            DepreciationValue = depreciation,
            BuildingsValueAfterDepreciation = buildingsAfterDep,
            CostOpinionBuildingsOnly = buildingsAfterDep,
            CostOpinionWithLand = CostApproachRules.CostOpinionForScope(
                buildingsAfterDep,
                land,
                landEstimateComplete,
                CostScopeKeys.IsBuildingOnly(costScopeKey)),
            CostScopeKey = CostScopeKeys.Normalize(costScopeKey),
            BuildingAreaSqm = buildingArea,
            AnalysisNotes = entity?.AnalysisNotes,
            Lines = lines,
        };
    }
}
