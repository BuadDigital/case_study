using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Valuation.Application.Abstractions;
using RealEstateEval.Valuation.Infrastructure.Data.Contexts;
using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Valuation.Infrastructure.Services;

/// <summary>Contractor cost approach scaffold — land from market ; lines priced by appraiser.</summary>
public sealed class ValuationCostApproachService(
    ValuationDbContext db,
    ICaseStudyLookup caseStudy,
    IValuationComparableSelectionService selections,
    TimeProvider? time = null) : IValuationCostApproachService
{
    private readonly TimeProvider _time = time ?? TimeProvider.System;

    public async Task<ValuationCostApproachDto?> GetAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken = default)
    {
        var vr = await db.ValuationRequests.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == valuationRequestId, cancellationToken);
        if (vr is null) return null;

        var entity = await db.ValuationCostApproaches.AsNoTracking()
            .Include(x => x.Lines)
            .Include(x => x.IndirectItems)
            .FirstOrDefaultAsync(x => x.ValuationRequestId == valuationRequestId, cancellationToken);

        var settings = await db.ValuationApproachSettings.AsNoTracking()
            .FirstOrDefaultAsync(x => x.ValuationRequestId == valuationRequestId, cancellationToken);

        return ToDto(vr, entity, CostScopeKeys.Normalize(settings?.CostScopeKey));
    }

    public async Task<(ValuationCostApproachDto? Result, Dictionary<string, string>? Errors)> SaveAsync(
        Guid valuationRequestId,
        SaveValuationCostApproachRequest request,
        CancellationToken cancellationToken = default)
    {
        var vr = await db.ValuationRequests
            .FirstOrDefaultAsync(x => x.Id == valuationRequestId, cancellationToken);
        if (vr is null)
            return (null, new Dictionary<string, string> { ["_"] = "طلب التقييم غير موجود" });
        if (vr.Status == ValuationRequestStatus.Done)
            return (null, new Dictionary<string, string> { ["_"] = "طلب التقييم مكتمل" });
        // ق-6: بعد صدور نسخة الإيداع يتجمّد التقرير كاملاً — الرمز والشهادة فقط خارج التجميد.
        if (await ValuationReportFreeze.IsFrozenAsync(db, vr.Id, cancellationToken))
            return (null, new Dictionary<string, string> { ["_"] = ValuationReportFreeze.FrozenMessageAr });

 // ق-2/ق-3 المعدَّل: cost tab is closed when the approach is off (bare land defaults it off;
 // land WITH structures opens it for the structure lines only — spec v2 §3).
        var approachSettings = await db.ValuationApproachSettings.AsNoTracking()
            .FirstOrDefaultAsync(x => x.ValuationRequestId == valuationRequestId, cancellationToken);
        var hasStructures = false;
        if (Guid.TryParse(vr.PropertyId?.Trim(), out var propertyGuid))
        {
            var context = await caseStudy.GetValuationPropertyContextAsync(
                propertyGuid,
                cancellationToken);
            hasStructures = string.Equals(
                context?.HasStructuresToValue.Trim(),
                "yes",
                StringComparison.OrdinalIgnoreCase);
        }

        var costEnabled = approachSettings?.CostApproachEnabled
            ?? ValuationApproachSettingsRules.CanEnableCostApproach(vr.PropertyType, hasStructures);
        if (!costEnabled)
        {
            return (null, new Dictionary<string, string>
            {
                ["_"] = !ValuationApproachSettingsRules.CanEnableCostApproach(vr.PropertyType, hasStructures)
                    ? "ق-3: أرض بلا إنشاءات لا تُقيَّم بالتكلفة — أسلوب التكلفة لا ينطبق"
                    : "أسلوب التكلفة غير مفعَّل في إعدادات التقييم (شاشة 1)",
            });
        }

        var lines = request.Lines ?? [];
        var errors = new Dictionary<string, string>();
        for (var i = 0; i < lines.Count; i++)
        {
            var line = lines[i];
            if (string.IsNullOrWhiteSpace(line.Label)
                && CostLineItemKeys.Normalize(line.ItemKey) == CostLineItemKeys.Custom)
                errors[$"lines[{i}].label"] = "تسمية البند مطلوبة";
            if (line.AreaSqm < 0m)
                errors[$"lines[{i}].areaSqm"] = "الكمية يجب أن تكون ≥ 0";
            if (line.UnitCostSar < 0m)
                errors[$"lines[{i}].unitCostSar"] = "تكلفة الوحدة يجب أن تكون ≥ 0";
            if (line.Unit is not null && !CostLineUnits.IsKnown(line.Unit))
                errors[$"lines[{i}].unit"] = "وحدة القياس غير معروفة (م² / م.ط / عدد / مقطوع)";
            if (line.BuildRatioPct is < 0m or > 100m)
                errors[$"lines[{i}].buildRatioPct"] = "نسبة البناء يجب أن تكون بين 0 و 100";
            if (line.RepeatedFloorCount is < 0)
                errors[$"lines[{i}].repeatedFloorCount"] = "عدد الأدوار المتكررة يجب أن يكون ≥ 0";
        }

        // «المنع يقع عند الاعتماد فقط»: المبررات تُطالب بها التنبيهات المنهجية (m6/m10/m12) لا الحفظ.
        if (request.UseRestrictionDiscountPct is < 0m or > 100m)
            errors["useRestrictionDiscountPct"] = "خصم تقييد الاستخدام يجب أن يكون بين 0 و 100";
        if (request.ApartmentLandShareSqm is < 0m)
            errors["apartmentLandShareSqm"] = "حصة الشقة من الأرض يجب أن تكون ≥ 0";

        var indirectItems = request.IndirectItems ?? [];
        var seenKeys = new HashSet<string>(StringComparer.Ordinal);
        for (var i = 0; i < indirectItems.Count; i++)
        {
            var item = indirectItems[i];
            if (!IndirectCostItemKeys.IsKnown(item.ItemKey))
                errors[$"indirectItems[{i}].itemKey"] = "بند غير معروف من بنود التكاليف غير المباشرة";
            else if (!seenKeys.Add(item.ItemKey))
                errors[$"indirectItems[{i}].itemKey"] = "بند مكرر";
            if (item.Pct < 0m || item.Pct > CostApproachRules.IndirectItemMaxPct)
                errors[$"indirectItems[{i}].pct"] = "النسبة يجب أن تكون بين 0 و 50";
        }

        if (request.FinancingAnnualRatePct is < 0m or > CostApproachRules.FinancingAnnualRateMaxPct)
            errors["financingAnnualRatePct"] = "المعدل السنوي يجب أن يكون بين 0 و 30";
        if (request.FinancingMonths is < 0 or > CostApproachRules.FinancingMonthsMax)
            errors["financingMonths"] = "مدة التنفيذ يجب أن تكون بين 0 و 120 شهرًا";

        if (request.ActualAgeYears is < 0m)
            errors["actualAgeYears"] = "العمر الفعلي يجب أن يكون ≥ 0";
        if (request.EconomicAgeYears is < 0m)
            errors["economicAgeYears"] = "العمر الاقتصادي يجب أن يكون ≥ 0";
        if (request.LifeExtensionYears < 0m)
            errors["lifeExtensionYears"] = "تمديد العمر يجب أن يكون ≥ 0";
        if (request.FunctionalObsolescencePct is < 0m or > 100m)
            errors["functionalObsolescencePct"] = "التقادم الوظيفي يجب أن يكون بين 0 و 100";
        if (request.ExternalObsolescencePct is < 0m or > 100m)
            errors["externalObsolescencePct"] = "التقادم الخارجي يجب أن يكون بين 0 و 100";

        if (errors.Count > 0) return (null, errors);

        var entity = await db.ValuationCostApproaches
            .Include(x => x.Lines)
            .Include(x => x.IndirectItems)
            .FirstOrDefaultAsync(x => x.ValuationRequestId == valuationRequestId, cancellationToken);
        if (entity is null)
        {
            entity = new ValuationCostApproach
            {
                Id = Guid.NewGuid(),
                ValuationRequestId = valuationRequestId,
            };
            db.ValuationCostApproaches.Add(entity);
        }

        if (request.RefreshLandFromLandComps)
        {
            // أرض التكلفة من جدول land_within_cost فقط — لا استيراد من أسلوب السوق.
            var landComps = await selections.ListAsync(
                valuationRequestId,
                ComparableSelectionContexts.LandWithinCost,
                cancellationToken);
            entity.LandUnitRateFromMarket = landComps?.WeightedPricePerSqm ?? 0m;
            entity.LandAreaSqm = landComps?.SubjectAreaSqm ?? 0m;
            entity.LandImportedAtUtc = landComps is { AdoptedCount: > 0 }
                ? _time.UtcNow()
                : null;
        }

        entity.UseRestrictionDiscountPct = request.UseRestrictionDiscountPct;
        entity.UseRestrictionRationale = string.IsNullOrWhiteSpace(request.UseRestrictionRationale)
            ? null
            : request.UseRestrictionRationale.Trim();
        entity.ApartmentLandShareSqm = request.ApartmentLandShareSqm;
        entity.LandValueFromMarket = CostApproachRules.LandValue(
            CostApproachRules.LandUnitRateAfterDiscount(
                entity.LandUnitRateFromMarket, entity.UseRestrictionDiscountPct),
            entity.LandAreaSqm,
            entity.ApartmentLandShareSqm);

        // Upsert in place — navigation-adds with pre-set GUIDs get marked Modified
        // by EF's graph heuristic (UPDATE 0 rows → global 409) on re-saves.
        var linesById = entity.Lines.ToDictionary(l => l.Id);
        var keepLines = new HashSet<Guid>();

 // repeated-floors quantity derives from the first-floor area × count.
        var firstFloorArea = lines
            .Where(l => CostLineItemKeys.Normalize(l.ItemKey) == CostLineItemKeys.FirstFloor)
            .Select(l => l.AreaSqm)
            .FirstOrDefault();

        for (var i = 0; i < lines.Count; i++)
        {
            var line = lines[i];
            var itemKey = CostLineItemKeys.Normalize(line.ItemKey);
            var quantity = line.AreaSqm;
            if (itemKey == CostLineItemKeys.RepeatedFloors
                && line.RepeatedFloorCount is { } count && count > 0
                && firstFloorArea > 0m)
            {
                quantity = RepeatedFloorRules.DeriveQuantity(firstFloorArea, count);
            }

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
                db.ValuationCostLines.Add(new ValuationCostLine
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
                });
            }
            keepLines.Add(lineId);
        }
        db.ValuationCostLines.RemoveRange(
            entity.Lines.Where(l => !keepLines.Contains(l.Id)).ToList());

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
                db.ValuationIndirectCostItems.Add(new ValuationIndirectCostItem
                {
                    Id = Guid.NewGuid(),
                    CostApproachId = entity.Id,
                    ItemKey = item.ItemKey,
                    Pct = item.Pct,
                    Rationale = rationale,
                    SortOrder = sortOrder,
                });
            }
            keepIndirect.Add(item.ItemKey);
        }
        db.ValuationIndirectCostItems.RemoveRange(
            entity.IndirectItems.Where(x => !keepIndirect.Contains(x.ItemKey)).ToList());

        entity.FinancingAnnualRatePct = request.FinancingAnnualRatePct;
        entity.FinancingMonths = request.FinancingMonths;
        entity.ActualAgeYears = request.ActualAgeYears;
        entity.EconomicAgeYears = request.EconomicAgeYears;
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
        await db.SaveChangesAsync(cancellationToken);

        return (await GetAsync(valuationRequestId, cancellationToken), null);
    }

    private static ValuationCostApproachDto ToDto(
        ValuationRequest vr,
        ValuationCostApproach? entity,
        string costScopeKey)
    {
        var orderedLines = (entity?.Lines ?? []).OrderBy(l => l.SortOrder).ToList();

        // مواصفة النموذج التفاعلي: بند المتكررة يرث سعر متر «الدور الأول» عند تركه فارغاً.
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
                    l.AreaSqm, l.Unit, l.BuildRatioPct);
                return (Line: l,
                    EffectiveUnitCost: effectiveUnitCost,
                    Inherited: effectiveUnitCost != Math.Max(0m, l.UnitCostSar),
                    EffectiveQty: effectiveQty,
                    Total: CostApproachRules.LineTotal(effectiveQty, effectiveUnitCost));
            })
            .ToList();

        var direct = computed.Where(c => c.Line.IsIncluded).Sum(c => c.Total);
        var land = entity?.LandValueFromMarket ?? 0m;
        var rateAfterDiscount = CostApproachRules.LandUnitRateAfterDiscount(
            entity?.LandUnitRateFromMarket ?? 0m,
            entity?.UseRestrictionDiscountPct ?? 0m);
        var landEstimateComplete =
            (entity?.LandUnitRateFromMarket ?? 0m) > 0m
            && (entity?.LandAreaSqm ?? 0m) > 0m;

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

        // مسطحات البناء: Σ الكمية الفعلية لبنود م² في مجموعة المسطحات
        // (بما فيها البنود المخصصة المدرجة في المجموعة عبر structureKind = floor).
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
        var physicalPct = CostApproachRules.PhysicalObsolescencePct(
            entity?.ActualAgeYears, extendedLife);
        var totalObsolescence = CostApproachRules.TotalObsolescencePct(
            physicalPct,
            entity?.FunctionalObsolescencePct ?? 0m,
            entity?.ExternalObsolescencePct ?? 0m);
        var depreciation = CostApproachRules.DepreciationValue(totalCost, totalObsolescence);
        var buildingsAfterDep = CostApproachRules.BuildingsAfterDepreciation(totalCost, depreciation);

        return new ValuationCostApproachDto
        {
            ValuationRequestId = vr.Id,
            PropertyId = vr.PropertyId,
            LandUnitRateFromMarket = entity?.LandUnitRateFromMarket ?? 0m,
            LandAreaSqm = entity?.LandAreaSqm ?? 0m,
            LandEstimateComplete = landEstimateComplete,
            UseRestrictionDiscountPct = entity?.UseRestrictionDiscountPct ?? 0m,
            UseRestrictionRationale = entity?.UseRestrictionRationale,
            ApartmentLandShareSqm = entity?.ApartmentLandShareSqm,
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
            EconomicAgeYears = entity?.EconomicAgeYears,
            LifeExtensionYears = entity?.LifeExtensionYears ?? 0m,
            LifeExtensionBasis = entity?.LifeExtensionBasis,
            FunctionalObsolescencePct = entity?.FunctionalObsolescencePct ?? 0m,
            FunctionalObsolescenceRationale = entity?.FunctionalObsolescenceRationale,
            ExternalObsolescencePct = entity?.ExternalObsolescencePct ?? 0m,
            ExternalObsolescenceRationale = entity?.ExternalObsolescenceRationale,
            ExtendedLifeYears = extendedLife,
            PhysicalObsolescencePct = physicalPct,
            TotalObsolescencePct = totalObsolescence,
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
