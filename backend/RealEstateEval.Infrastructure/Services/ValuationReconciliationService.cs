using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Infrastructure.Services;

/// <summary>Method participation + round-once final opinion; liquidation discount when basis allows.</summary>
public sealed class ValuationReconciliationService(
    ValuationDbContext db,
    CaseStudyDbContext caseStudy,
    PlatformDbContext platformDb,
    IAuditLogWriter audit,
    IValuationComparableSelectionService selections,
    IValuationCostApproachService costApproach) : IValuationReconciliationService
{
    public async Task<ValuationReconciliationDto?> GetAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken = default)
    {
        var vr = await db.ValuationRequests.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == valuationRequestId, cancellationToken);
        if (vr is null) return null;

        var market = await selections.ListAsync(valuationRequestId, cancellationToken);
        var cost = await costApproach.GetAsync(valuationRequestId, cancellationToken);
        var entity = await db.ValuationReconciliations.AsNoTracking()
            .Include(x => x.Methods)
            .FirstOrDefaultAsync(x => x.ValuationRequestId == valuationRequestId, cancellationToken);

        return ToDto(
            vr,
            market?.MarketOpinionValue ?? 0m,
            cost?.CostOpinionWithLand ?? 0m,
            entity,
            await GetEnabledKindsAsync(vr, cancellationToken));
    }

 /// <summary>ق-2: الأسلوب غير المفعَّل لا يظهر صفاً ولا يدخل في الوزن.</summary>
    private async Task<IReadOnlyList<string>> GetEnabledKindsAsync(
        ValuationRequest vr,
        CancellationToken cancellationToken)
    {
        var settings = await db.ValuationApproachSettings.AsNoTracking()
            .FirstOrDefaultAsync(x => x.ValuationRequestId == vr.Id, cancellationToken);
        if (settings is null)
        {
            var hasStructures = false;
            if (Guid.TryParse(vr.PropertyId?.Trim(), out var propertyGuid))
            {
                var answer = await caseStudy.WorkOrderProperties.AsNoTracking()
                    .Where(p => p.Id == propertyGuid)
                    .Select(p => p.HasStructuresToValue)
                    .FirstOrDefaultAsync(cancellationToken);
                hasStructures = string.Equals(answer?.Trim(), "yes", StringComparison.OrdinalIgnoreCase);
            }

            settings = ValuationApproachSettingsRules.Defaults(vr.Id, vr.PropertyType, hasStructures);
        }

        return ValuationApproachSettingsRules.EnabledReconciliationKinds(
            settings.MarketApproachEnabled,
            settings.CostApproachEnabled);
    }

    public async Task<(ValuationReconciliationDto? Result, Dictionary<string, string>? Errors)> SaveAsync(
        Guid valuationRequestId,
        SaveValuationReconciliationRequest request,
        string? actorId = null,
        CancellationToken cancellationToken = default)
    {
        var vr = await db.ValuationRequests
            .FirstOrDefaultAsync(x => x.Id == valuationRequestId, cancellationToken);
        if (vr is null)
            return (null, new Dictionary<string, string> { ["_"] = "طلب التقييم غير موجود" });
        if (vr.Status == ValuationRequestStatus.Done)
            return (null, new Dictionary<string, string> { ["_"] = "طلب التقييم مكتمل" });

 // بوابة جودة قبل الحساب لا عند الإصدار فقط: traditional deeds must clear
 // the deed↔nature match before the final opinion is computed (registered title skips).
        if (Guid.TryParse(vr.PropertyId?.Trim(), out var propertyGuid))
        {
            var prop = await caseStudy.WorkOrderProperties.AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == propertyGuid, cancellationToken);
            if (prop is not null && DeedKindRules.RequiresDeedNatureMatchGate(prop.DeedKind))
            {
                var matchOutcome = await caseStudy.CaseStudyForms.AsNoTracking()
                    .Where(f => f.PropertyId == propertyGuid && !f.IsPartyForm)
                    .OrderByDescending(f => f.UpdatedAtUtc)
                    .Select(f => f.DeedNatureMatchOutcome)
                    .FirstOrDefaultAsync(cancellationToken) ?? "";
                if (!DeedKindRules.AllowsValuationCalc(prop.DeedKind, matchOutcome))
                {
                    return (null, new Dictionary<string, string>
                    {
                        ["_"] = "بوابة المطابقة: صك تقليدي بلا مطابقة محسومة — يحسمها دارس الحالة قبل الحساب",
                    });
                }
            }
        }

        var methods = request.Methods ?? [];
        var errors = new Dictionary<string, string>();

        if (string.IsNullOrWhiteSpace(request.MethodsRationale))
            errors["methodsRationale"] = "مبرر استخدام طرق التقييم مطلوب";

        if (request.FinalRoundDecimals is < 0 or > 4)
            errors["finalRoundDecimals"] = "خانات التقريب يجب أن تكون بين 0 و 4";

        if (request.LiquidationDiscountPct is < 0m or > 100m)
            errors["liquidationDiscountPct"] = "نسبة الخصم يجب أن تكون بين 0 و 100";

        var basisKey = string.IsNullOrWhiteSpace(request.BasisOfValueKey)
            ? BasisOfValueKeys.Market
            : request.BasisOfValueKey.Trim().ToLowerInvariant();
        if (!BasisOfValueKeys.IsKnown(basisKey))
            errors["basisOfValueKey"] = "أساس القيمة غير معروف";

        var premiseKey = string.IsNullOrWhiteSpace(request.ValuePremiseKey)
            ? null
            : request.ValuePremiseKey.Trim().ToLowerInvariant();
        if (premiseKey is not null && !ValuePremiseKeys.IsKnown(premiseKey))
            errors["valuePremiseKey"] = "فرضية القيمة غير معروفة";
        else if (premiseKey is not null && !ValuePremiseKeys.IsCompatible(basisKey, premiseKey))
            errors["valuePremiseKey"] = "فرضية القيمة غير متوافقة مع أساس القيمة المختار";

        if (string.Equals(basisKey, BasisOfValueKeys.Liquidation, StringComparison.Ordinal)
            && request.LiquidationDiscountPct > 0m
            && premiseKey is null)
        {
            errors["valuePremiseKey"] = "فرضية القيمة مطلوبة عند خصم التصفية";
        }

        if (request.LiquidationDiscountPct > 0m
            && !string.Equals(basisKey, BasisOfValueKeys.Liquidation, StringComparison.Ordinal))
        {
            errors["liquidationDiscountPct"] = "خصم التصفية يُطبَّق فقط عند أساس = قيمة التصفية";
        }

        if (request.LiquidationDiscountPct > 0m
            && string.IsNullOrWhiteSpace(request.LiquidationDiscountRationale))
        {
            errors["liquidationDiscountRationale"] = "مبرر معامل التصفية مطلوب عند إدخال نسبة";
        }

        var alertOverrides = NormalizeAlertOverrides(request.MethodologyAlertOverrides);
        foreach (var ov in alertOverrides)
        {
            if (string.IsNullOrWhiteSpace(ov.Code))
                continue;
 // Soft overrides are free-form; hard alerts cannot be overridden via this channel.
        }

        var enabledKinds = await GetEnabledKindsAsync(vr, cancellationToken);

        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        for (var i = 0; i < methods.Count; i++)
        {
            var m = methods[i];
            if (!ValuationApproachKinds.IsKnown(m.ApproachKind))
                errors[$"methods[{i}].approachKind"] = "أسلوب غير معروف";
            else if (!enabledKinds.Contains(m.ApproachKind.Trim().ToLowerInvariant(), StringComparer.OrdinalIgnoreCase))
                errors[$"methods[{i}].approachKind"] = "ق-2: الأسلوب غير مفعَّل في إعدادات التقييم فلا يدخل في الترجيح";
            else if (!seen.Add(m.ApproachKind.Trim().ToLowerInvariant()))
                errors[$"methods[{i}].approachKind"] = "لا يُكرَّر الأسلوب";

            if (m.WeightPct is < 0m or > 100m)
                errors[$"methods[{i}].weightPct"] = "نسبة المشاركة يجب أن تكون بين 0 و 100";

            if (ReconciliationRules.RequiresWeightRationale(m.WeightPct, m.IsIncluded)
                && string.IsNullOrWhiteSpace(m.Rationale))
            {
                errors[$"methods[{i}].rationale"] = "مبرر نسبة المشاركة إلزامي";
            }
        }

        var includedWeights = methods.Where(m => m.IsIncluded).Select(m => m.WeightPct);
        if (methods.Any(m => m.IsIncluded) && !ReconciliationRules.WeightsSumTo100(includedWeights))
            errors["weightSum"] = "مجموع نسب المشاركة يجب أن يساوي 100٪";

        if (errors.Count > 0) return (null, errors);

        var market = await selections.ListAsync(valuationRequestId, cancellationToken);
        var cost = await costApproach.GetAsync(valuationRequestId, cancellationToken);
        var marketValue = market?.MarketOpinionValue ?? 0m;
        var costValue = cost?.CostOpinionWithLand ?? 0m;

        var entity = await db.ValuationReconciliations
            .Include(x => x.Methods)
            .FirstOrDefaultAsync(x => x.ValuationRequestId == valuationRequestId, cancellationToken);
        if (entity is null)
        {
            entity = new ValuationReconciliation
            {
                Id = Guid.NewGuid(),
                ValuationRequestId = valuationRequestId,
            };
            db.ValuationReconciliations.Add(entity);
        }

        db.ValuationReconciliationMethodLines.RemoveRange(entity.Methods);
        entity.Methods.Clear();

        for (var i = 0; i < methods.Count; i++)
        {
            var m = methods[i];
            var kind = m.ApproachKind.Trim().ToLowerInvariant();
            var value = string.Equals(kind, ValuationApproachKinds.Cost, StringComparison.Ordinal)
                ? costValue
                : marketValue;

            entity.Methods.Add(new ValuationReconciliationMethodLine
            {
                Id = m.Id is { } id && id != Guid.Empty ? id : Guid.NewGuid(),
                ReconciliationId = entity.Id,
                ApproachKind = kind,
                ApproachValue = value,
                WeightPct = m.WeightPct,
                Rationale = m.Rationale?.Trim() ?? "",
                IsIncluded = m.IsIncluded,
                SortOrder = m.SortOrder != 0 ? m.SortOrder : i,
            });
        }

        entity.MethodsRationale = request.MethodsRationale.Trim();
        entity.FinalRoundDecimals = request.FinalRoundDecimals;
        entity.BasisOfValueKey = basisKey;
        entity.ValuePremiseKey = premiseKey;
        entity.LiquidationDiscountPct = request.LiquidationDiscountPct;
        entity.LiquidationDiscountRationale = string.IsNullOrWhiteSpace(request.LiquidationDiscountRationale)
            ? null
            : request.LiquidationDiscountRationale.Trim();
        var previousOverridesJson = entity.MethodologyAlertOverridesJson;
        entity.MethodologyAlertOverridesJson = alertOverrides.Count == 0
            ? null
            : System.Text.Json.JsonSerializer.Serialize(alertOverrides, AlertOverridesJsonOptions);
        entity.UpdatedAtUtc = DateTime.UtcNow;

        await db.SaveChangesAsync(cancellationToken);

 // س2 : every alert pass — rationale or acknowledgement —
 // leaves an audit trail. Logged best-effort after the main save.
        if (!string.Equals(previousOverridesJson, entity.MethodologyAlertOverridesJson, StringComparison.Ordinal))
        {
            platformDb.AuditLogs.Add(audit.Create(
                actorId: string.IsNullOrWhiteSpace(actorId) ? "unknown" : actorId,
                action: "valuation.alert-overrides.updated",
                entityType: "ValuationReconciliation",
                entityId: valuationRequestId.ToString("D"),
                before: ParseAlertOverrides(previousOverridesJson),
                after: alertOverrides));
            await platformDb.SaveChangesAsync(cancellationToken);
        }

        return (await GetAsync(valuationRequestId, cancellationToken), null);
    }

    private static ValuationReconciliationDto ToDto(
        ValuationRequest vr,
        decimal marketValue,
        decimal costValue,
        ValuationReconciliation? entity,
        IReadOnlyList<string> enabledKinds)
    {
 // ق-2: a disabled approach neither shows a row nor skews the suggestion split.
        var marketEnabled = enabledKinds.Contains(
            ValuationApproachKinds.Market, StringComparer.OrdinalIgnoreCase);
        var costEnabled = enabledKinds.Contains(
            ValuationApproachKinds.Cost, StringComparer.OrdinalIgnoreCase);
        var suggested = ReconciliationRules.SuggestWeights(
            marketEnabled ? marketValue : 0m,
            costEnabled ? costValue : 0m);
        var suggestedMap = suggested.ToDictionary(
            x => x.kind,
            x => x.weightPct,
            StringComparer.OrdinalIgnoreCase);

        var saved = (entity?.Methods ?? [])
            .ToDictionary(m => m.ApproachKind, StringComparer.OrdinalIgnoreCase);

        var kinds = enabledKinds;
        var methodDtos = new List<ValuationReconciliationMethodDto>();

        for (var i = 0; i < kinds.Count; i++)
        {
            var kind = kinds[i];
            var liveValue = kind == ValuationApproachKinds.Cost ? costValue : marketValue;
            saved.TryGetValue(kind, out var row);
            var weight = row?.WeightPct
                ?? suggestedMap.GetValueOrDefault(kind, 0m);
            var isIncluded = row?.IsIncluded ?? (liveValue > 0m && weight > 0m);

            methodDtos.Add(new ValuationReconciliationMethodDto
            {
                Id = row?.Id,
                ApproachKind = kind,
                LabelAr = ValuationApproachKinds.LabelAr(kind),
                ApproachValue = liveValue,
                WeightPct = weight,
                SuggestedWeightPct = suggestedMap.GetValueOrDefault(kind, 0m),
                ContributionValue = isIncluded
                    ? ReconciliationRules.Contribution(liveValue, weight)
                    : 0m,
                Rationale = row?.Rationale ?? "",
                IsIncluded = isIncluded,
                SortOrder = row?.SortOrder ?? i,
            });
        }

        var includedMethods = methodDtos
            .Where(m => m.IsIncluded)
            .Select(m => (m.ApproachValue, m.WeightPct, true))
            .ToList();
        var weightSum = methodDtos.Where(m => m.IsIncluded).Sum(m => m.WeightPct);
        var weighted = ReconciliationRules.WeightedValue(includedMethods);
        var decimals = entity?.FinalRoundDecimals ?? 0;
        var basis = entity?.BasisOfValueKey ?? BasisOfValueKeys.Market;
        var premise = entity?.ValuePremiseKey;
        var discountPct = entity?.LiquidationDiscountPct ?? 0m;
        var (before, final, applied) = ReconciliationRules.FinalOpinionWithOptionalDiscount(
            weighted,
            decimals,
            basis,
            premise,
            discountPct);

        return new ValuationReconciliationDto
        {
            ValuationRequestId = vr.Id,
            PropertyId = vr.PropertyId,
            MarketOpinionValue = marketValue,
            CostOpinionWithLand = costValue,
            Methods = methodDtos,
            WeightSumPct = weightSum,
            WeightsSumTo100 = includedMethods.Count == 0
                || ReconciliationRules.WeightsSumTo100(includedMethods.Select(m => m.WeightPct)),
            MeetsMultiMethodGate = ReconciliationRules.MeetsMultiMethodGate(includedMethods),
            WeightedValue = weighted,
            FinalRoundDecimals = decimals,
            FinalOpinionValue = final,
            FinalOpinionBeforeLiquidation = before,
            MethodsRationale = entity?.MethodsRationale ?? "",
            BasisOfValueKey = basis,
            BasisOfValueLabelAr = BasisOfValueKeys.LabelAr(basis),
            ValuePremiseKey = premise,
            ValuePremiseLabelAr = string.IsNullOrWhiteSpace(premise)
                ? null
                : ValuePremiseKeys.LabelAr(premise),
            LiquidationDiscountPct = discountPct,
            LiquidationDiscountRationale = entity?.LiquidationDiscountRationale,
            LiquidationDiscountApplied = applied,
            MethodologyAlertOverrides = ParseAlertOverrides(entity?.MethodologyAlertOverridesJson),
        };
    }

    private static readonly System.Text.Json.JsonSerializerOptions AlertOverridesJsonOptions = new()
    {
        PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
    };

    private static List<ValuationMethodologyAlertOverrideDto> NormalizeAlertOverrides(
        IReadOnlyList<ValuationMethodologyAlertOverrideDto>? items)
    {
        if (items is null || items.Count == 0) return [];
        return items
            .Where(x => !string.IsNullOrWhiteSpace(x.Code))
            .GroupBy(x => x.Code.Trim(), StringComparer.OrdinalIgnoreCase)
            .Select(g =>
            {
                var last = g.Last();
                return new ValuationMethodologyAlertOverrideDto
                {
                    Code = g.Key,
                    OverrideRationale = string.IsNullOrWhiteSpace(last.OverrideRationale)
                        ? null
                        : last.OverrideRationale.Trim(),
                    Acknowledged = last.Acknowledged,
                };
            })
            .ToList();
    }

    private static IReadOnlyList<ValuationMethodologyAlertOverrideDto> ParseAlertOverrides(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return [];
        try
        {
            return System.Text.Json.JsonSerializer.Deserialize<List<ValuationMethodologyAlertOverrideDto>>(
                       json, AlertOverridesJsonOptions)
                   ?? [];
        }
        catch (System.Text.Json.JsonException)
        {
            return [];
        }
    }
}
