using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Infrastructure.Services;

/// <summary>Contractor cost approach scaffold — land from market ; lines priced by appraiser.</summary>
public sealed class ValuationCostApproachService(
    ValuationDbContext db,
    CaseStudyDbContext caseStudy,
    IValuationComparableSelectionService selections) : IValuationCostApproachService
{
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

        return ToDto(vr, entity);
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

 // ق-2/ق-3 المعدَّل: cost tab is closed when the approach is off (bare land defaults it off;
 // land WITH structures opens it for the structure lines only — spec v2 §3).
        var approachSettings = await db.ValuationApproachSettings.AsNoTracking()
            .FirstOrDefaultAsync(x => x.ValuationRequestId == valuationRequestId, cancellationToken);
        var hasStructures = false;
        if (Guid.TryParse(vr.PropertyId?.Trim(), out var propertyGuid))
        {
            var answer = await caseStudy.WorkOrderProperties.AsNoTracking()
                .Where(p => p.Id == propertyGuid)
                .Select(p => p.HasStructuresToValue)
                .FirstOrDefaultAsync(cancellationToken);
            hasStructures = string.Equals(answer?.Trim(), "yes", StringComparison.OrdinalIgnoreCase);
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

        if (request.UseRestrictionDiscountPct is < 0m or > 100m)
            errors["useRestrictionDiscountPct"] = "خصم تقييد الاستخدام يجب أن يكون بين 0 و 100";
        if (request.UseRestrictionDiscountPct > 0m
            && string.IsNullOrWhiteSpace(request.UseRestrictionRationale))
            errors["useRestrictionRationale"] = "مبرر خصم تقييد الاستخدام إلزامي عند نسبة أكبر من صفر";
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
        if (request.LifeExtensionYears > 0m && string.IsNullOrWhiteSpace(request.LifeExtensionBasis))
            errors["lifeExtensionBasis"] = "بيان أساس تمديد العمر إلزامي عند التمديد";
        if (request.FunctionalObsolescencePct is < 0m or > 100m)
            errors["functionalObsolescencePct"] = "التقادم الوظيفي يجب أن يكون بين 0 و 100";
        if (request.FunctionalObsolescencePct > 0m
            && string.IsNullOrWhiteSpace(request.FunctionalObsolescenceRationale))
            errors["functionalObsolescenceRationale"] = "مبرر التقادم الوظيفي إلزامي";
        if (request.ExternalObsolescencePct is < 0m or > 100m)
            errors["externalObsolescencePct"] = "التقادم الخارجي يجب أن يكون بين 0 و 100";
        if (request.ExternalObsolescencePct > 0m
            && string.IsNullOrWhiteSpace(request.ExternalObsolescenceRationale))
            errors["externalObsolescenceRationale"] = "مبرر التقادم الخارجي إلزامي";

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

        if (request.ImportLandFromMarket)
        {
            var market = await selections.ListAsync(valuationRequestId, cancellationToken);
 // : import the weighted unit rate, never the whole-property opinion —
 // otherwise the building would be counted twice in the contractor method.
            entity.LandUnitRateFromMarket = market?.WeightedPricePerSqm ?? 0m;
            entity.LandAreaSqm = market?.SubjectAreaSqm ?? 0m;
            entity.LandImportedAtUtc = DateTime.UtcNow;
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

        db.ValuationCostLines.RemoveRange(entity.Lines);
        entity.Lines.Clear();

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

            entity.Lines.Add(new ValuationCostLine
            {
                Id = line.Id is { } id && id != Guid.Empty ? id : Guid.NewGuid(),
                CostApproachId = entity.Id,
                SourceInventoryLineId = line.SourceInventoryLineId,
                StructureKind = string.IsNullOrWhiteSpace(line.StructureKind)
                    ? BuildingStructureKinds.Other
                    : line.StructureKind.Trim(),
                ItemKey = itemKey,
                Label = string.IsNullOrWhiteSpace(line.Label)
                    ? CostLineItemKeys.LabelAr(itemKey)
                    : line.Label.Trim(),
                AreaSqm = quantity,
                Unit = CostLineUnits.Normalize(line.Unit ?? CostLineItemKeys.DefaultUnit(itemKey)),
                BuildRatioPct = line.BuildRatioPct,
                RepeatedFloorCount = line.RepeatedFloorCount,
                UnitCostSar = line.UnitCostSar,
                Rationale = line.Rationale?.Trim() ?? "",
                IsIncluded = line.IsIncluded,
                SortOrder = line.SortOrder != 0 ? line.SortOrder : i,
            });
        }

        db.ValuationIndirectCostItems.RemoveRange(entity.IndirectItems);
        entity.IndirectItems.Clear();
        for (var i = 0; i < indirectItems.Count; i++)
        {
            var item = indirectItems[i];
            entity.IndirectItems.Add(new ValuationIndirectCostItem
            {
                Id = Guid.NewGuid(),
                CostApproachId = entity.Id,
                ItemKey = item.ItemKey,
                Pct = item.Pct,
                Rationale = string.IsNullOrWhiteSpace(item.Rationale) ? null : item.Rationale.Trim(),
                SortOrder = item.SortOrder != 0 ? item.SortOrder : i,
            });
        }

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
        entity.UpdatedAtUtc = DateTime.UtcNow;
        await db.SaveChangesAsync(cancellationToken);

        return (await GetAsync(valuationRequestId, cancellationToken), null);
    }

    private static ValuationCostApproachDto ToDto(ValuationRequest vr, ValuationCostApproach? entity)
    {
        var lines = (entity?.Lines ?? [])
            .OrderBy(l => l.SortOrder)
            .Select(l => new ValuationCostLineDto
            {
                Id = l.Id,
                SourceInventoryLineId = l.SourceInventoryLineId,
                StructureKind = l.StructureKind,
                ItemKey = l.ItemKey,
                ItemLabelAr = CostLineItemKeys.LabelAr(l.ItemKey),
                Label = l.Label,
                AreaSqm = l.AreaSqm,
                Unit = l.Unit,
                UnitLabelAr = CostLineUnits.LabelAr(l.Unit),
                BuildRatioPct = l.BuildRatioPct,
                RepeatedFloorCount = l.RepeatedFloorCount,
                UnitCostSar = l.UnitCostSar,
                LineTotal = CostApproachRules.LineTotal(l.AreaSqm, l.UnitCostSar),
                Rationale = l.Rationale,
                IsIncluded = l.IsIncluded,
                SortOrder = l.SortOrder,
            })
            .ToList();

        var direct = CostApproachRules.SumDirectCost(
            lines.Select(l => (l.AreaSqm, l.UnitCostSar, l.IsIncluded)));
        var land = entity?.LandValueFromMarket ?? 0m;
        var rateAfterDiscount = CostApproachRules.LandUnitRateAfterDiscount(
            entity?.LandUnitRateFromMarket ?? 0m,
            entity?.UseRestrictionDiscountPct ?? 0m);

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
            CostOpinionWithLand = CostApproachRules.CostOpinionWithLand(buildingsAfterDep, land),
            AnalysisNotes = entity?.AnalysisNotes,
            Lines = lines,
        };
    }
}
