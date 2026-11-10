// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 1 (5b554f4e)
//  • (superseded 2026-11-10) The appraiser's saved basis and premise won; the work order only seeded them.
// Hotfix (9acb4f54)
//  • A row that only an alert acknowledgement created (no methods rationale = no full save) never
//         outranks the work order's basis and premise.
// Grey areas (2026-11-10, owner's ruling)
//  • The work order owns the basis and premise (ResolveBasisAndPremise); the appraiser's saved keys
//         count only when the work order has none. The discount is 0 on any basis but liquidation.
// ──────────────────────────────────────────────────────────────────────────────────────────────

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
 // A disabled approach neither shows a row nor skews the suggestion split.
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
                : ValuationApproachKinds.ValueOf(kind, marketValue, costValue);
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
        // One owner (ruling 2026-11-10): the work order's basis and premise always win; the
        // appraiser's saved keys count only when the work order has none (legacy), and only from a
        // full save — a row an alert acknowledgement created (no methods rationale) holds no choice.
        var (basis, premise) = ResolveBasisAndPremise(
            entity, assignmentType, workOrderBasisKey, workOrderPremiseKey);
        // The discount exists only on the liquidation basis: 0 (and no rationale) on any other, in
        // the value, the screen, the report and the hand-over alike.
        var isLiquidation = string.Equals(basis, BasisOfValueKeys.Liquidation, StringComparison.Ordinal);
        var discountPct = isLiquidation ? entity?.LiquidationDiscountPct ?? 0m : 0m;
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
            LiquidationDiscountRationale = isLiquidation ? entity?.LiquidationDiscountRationale : null,
            LiquidationDiscountApplied = applied,
            MethodologyAlertOverrides = ParseAlertOverrides(entity?.MethodologyAlertOverridesJson),
        };
    }

    /// <summary>
    /// Keeps the stored reconciliation snapshot equal to the live projection (Fix 4, 2026-11-10).
    ///
    /// How it works: for each stored method row whose kind the projection shows, the stored
    /// ApproachValue takes the live one; the stored basis/premise take the resolved keys. Only when
    /// something differs, and only when the report is not frozen, are the changes saved. The request
    /// list then computes its final value from these rows with the same rules
    /// (<see cref="ReconciliationRules.FinalFromSnapshot"/>) — one batched query, no per-row calls
    /// to Case Study, market or cost.
    ///
    /// Edge cases: no stored row → nothing to refresh (the list shows no value until a save); a row
    /// for an approach the projection no longer shows (disabled since) is left as saved; weights,
    /// inclusion, rationale and the discount are never changed here. A failed write (e.g. a
    /// concurrent save bumped the row version) is ignored — the read must not fail and the next read
    /// refreshes again. Deposited/frozen reports are never touched.
    /// </summary>
    public async Task RefreshListSnapshotAsync(
        Guid valuationRequestId,
        ValuationReconciliationDto projection,
        CancellationToken cancellationToken = default)
    {
        var entity = await repo.FindWithMethodsAsync(valuationRequestId, cancellationToken);
        if (entity is null) return;

        var changed = false;
        foreach (var row in entity.Methods)
        {
            var live = projection.Methods.FirstOrDefault(m =>
                string.Equals(m.ApproachKind, row.ApproachKind, StringComparison.OrdinalIgnoreCase));
            if (live is null || row.ApproachValue == live.ApproachValue) continue;
            row.ApproachValue = live.ApproachValue;
            changed = true;
        }
        if (!string.Equals(entity.BasisOfValueKey, projection.BasisOfValueKey, StringComparison.Ordinal))
        {
            entity.BasisOfValueKey = projection.BasisOfValueKey;
            changed = true;
        }
        if (!string.Equals(entity.ValuePremiseKey, projection.ValuePremiseKey, StringComparison.Ordinal))
        {
            entity.ValuePremiseKey = projection.ValuePremiseKey;
            changed = true;
        }
        if (!changed) return;

        var vr = await repo.GetRequestAsync(valuationRequestId, cancellationToken);
        if (vr is null) return;
        if (await freeze.GetWriteBlockedMessageAsync(vr, "طلب التقييم مكتمل", cancellationToken) is not null)
            return;
        try
        {
            await repo.SaveChangesAsync(cancellationToken);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // Best-effort cache refresh: a concurrent save wins; the next read refreshes again.
        }
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

    /// <summary>
    /// The basis and premise of this valuation through the one shared order
    /// (<see cref="AssignmentValuationDefaults.ResolveBasisAndPremise"/>).
    /// How it works: the saved keys are offered as the legacy fallback only after a full save
    /// (methods rationale written). Edge cases: no row / acknowledgement-only row → work order, then
    /// the assignment default. Fixed 2026-11-10: the appraiser's saved basis outranked the work order.
    /// </summary>
    internal static (string Basis, string Premise) ResolveBasisAndPremise(
        ValuationReconciliation? entity,
        AssignmentType assignmentType,
        string? workOrderBasisKey,
        string? workOrderPremiseKey)
    {
        var appraiserSaved = !string.IsNullOrWhiteSpace(entity?.MethodsRationale);
        return AssignmentValuationDefaults.ResolveBasisAndPremise(
            assignmentType,
            workOrderBasisKey,
            workOrderPremiseKey,
            appraiserSaved ? entity!.BasisOfValueKey : null,
            appraiserSaved ? entity!.ValuePremiseKey : null);
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
