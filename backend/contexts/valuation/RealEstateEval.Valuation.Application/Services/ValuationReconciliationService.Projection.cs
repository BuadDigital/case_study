using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Valuation.Application.Abstractions;
using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Application.Rules;
using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Valuation.Application.Services;

/// <summary>
/// Read model of the reconciliation: participation rows (internal approaches and document
/// indicators), the round-once final value with the document additions, and the alert
/// overrides kept as JSON.
/// </summary>
public sealed partial class ValuationReconciliationService
{
    private static ValuationReconciliationDto ToDto(
        ValuationRequest vr,
        decimal marketValue,
        decimal costValue,
        ValuationReconciliation? entity,
        IReadOnlyList<string> enabledKinds,
        IReadOnlyList<ValuationValueDocumentUse> valueDocumentUses,
        AssignmentType assignmentType,
        string? workOrderBasisKey = null,
        string? workOrderPremiseKey = null)
    {
 // Q-2: a disabled approach neither shows a row nor skews the suggestion split.
        var marketEnabled = enabledKinds.Contains(
            ValuationApproachKinds.Market, StringComparer.OrdinalIgnoreCase);
        var costEnabled = enabledKinds.Contains(
            ValuationApproachKinds.Cost, StringComparer.OrdinalIgnoreCase);
        // «مستند ذو قيمة» indicators join the internal approaches as reconciliation rows.
        var indicators = valueDocumentUses
            .Where(ValueDocumentUseRules.IsIndicator)
            .ToDictionary(
                u => ValueDocumentUseRules.ReconciliationKind(u.AttachmentId),
                StringComparer.OrdinalIgnoreCase);
        var kinds = enabledKinds.Concat(indicators.Keys).ToList();
        var suggestedMap = ReconciliationRules.SuggestWeights(
            kinds,
            marketEnabled ? marketValue : 0m,
            costEnabled ? costValue : 0m);

        var saved = (entity?.Methods ?? [])
            .ToDictionary(m => m.ApproachKind, StringComparer.OrdinalIgnoreCase);

        var methodDtos = new List<ValuationReconciliationMethodDto>();

        for (var i = 0; i < kinds.Count; i++)
        {
            var kind = kinds[i];
            indicators.TryGetValue(kind, out var document);
            var liveValue = document is not null
                ? document.Value
                : kind == ValuationApproachKinds.Cost ? costValue : marketValue;
            saved.TryGetValue(kind, out var row);
            var suggestedWeight = suggestedMap.GetValueOrDefault(kind, 0m);
            var (weight, isIncluded) = ReconciliationRules.EffectiveParticipation(
                kinds.Count,
                row?.WeightPct,
                row is null ? null : row.IsIncluded,
                liveValue,
                suggestedWeight);

            methodDtos.Add(new ValuationReconciliationMethodDto
            {
                Id = row?.Id,
                ApproachKind = kind,
                LabelAr = document is not null
                    ? ValueDocumentUseRules.IndicatorLabelAr(document.ApproachKey, document.MethodName)
                    : ValuationApproachKinds.LabelAr(kind),
                ApproachValue = liveValue,
                WeightPct = weight,
                SuggestedWeightPct = suggestedMap.GetValueOrDefault(kind, 0m),
                ContributionValue = isIncluded
                    ? ReconciliationRules.Contribution(liveValue, weight)
                    : 0m,
                Rationale = row?.Rationale ?? "",
                IsIncluded = isIncluded,
                SortOrder = row?.SortOrder ?? i,
                ValueDocumentAttachmentId = document?.AttachmentId,
                DocumentApproachKey = document?.ApproachKey,
                DocumentMethodName = document?.MethodName,
            });
        }

        var includedMethods = methodDtos
            .Where(m => m.IsIncluded)
            .Select(m => (m.ApproachValue, m.WeightPct, true))
            .ToList();
        var weightSum = methodDtos.Where(m => m.IsIncluded).Sum(m => m.WeightPct);
        var weighted = ReconciliationRules.WeightedValue(includedMethods);
        var decimals = entity?.FinalRoundDecimals ?? 0;
        var basis = FirstValuationKey(
            workOrderBasisKey,
            entity?.BasisOfValueKey,
            AssignmentValuationDefaults.BasisOfValueKey(assignmentType));
        var premise = FirstValuationKey(
            workOrderPremiseKey,
            entity?.ValuePremiseKey,
            AssignmentValuationDefaults.PremiseKey(assignmentType));
        var discountPct = entity?.LiquidationDiscountPct ?? 0m;
        var additions = valueDocumentUses
            .Where(ValueDocumentUseRules.IsAddition)
            .Select(u => new ValuationValueDocumentAdditionDto
            {
                AttachmentId = u.AttachmentId,
                LabelAr = u.DocumentLabel,
                Value = u.Value,
            })
            .ToList();
        var additionsTotal = additions.Sum(a => a.Value);
        var (before, propertyAfterDiscount, final, applied) = ReconciliationRules.FinalTotal(
            weighted,
            decimals,
            basis,
            premise,
            discountPct,
            additionsTotal);

        return new ValuationReconciliationDto
        {
            ValuationRequestId = vr.Id,
            PropertyId = vr.PropertyId.ToString("D"),
            MarketOpinionValue = marketValue,
            CostOpinionWithLand = costValue,
            Methods = methodDtos,
            WeightSumPct = weightSum,
            WeightsSumTo100 = includedMethods.Count == 0
                || ReconciliationRules.WeightsSumTo100(includedMethods.Select(m => m.WeightPct)),
            MeetsMultiMethodGate = ReconciliationRules.MeetsMultiMethodGate(kinds.Count),
            WeightedValue = weighted,
            FinalRoundDecimals = decimals,
            FinalOpinionValue = final,
            FinalOpinionBeforeLiquidation = before,
            PropertyValueAfterLiquidation = propertyAfterDiscount,
            Additions = additions,
            AdditionsTotal = additionsTotal,
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

    private static string FirstValuationKey(params string?[] keys)
    {
        foreach (var key in keys)
        {
            var trimmed = key?.Trim();
            if (!string.IsNullOrEmpty(trimmed)) return trimmed;
        }
        return "";
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
