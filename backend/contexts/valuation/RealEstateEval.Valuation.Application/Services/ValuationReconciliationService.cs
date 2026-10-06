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
/// Method participation plus the round-once final opinion, with a liquidation discount when the
/// basis allows it. Persistence goes through <see cref="IValuationReconciliationRepository"/>
/// and the ق-6 freeze through <see cref="IValuationReportFreezeGate"/>, so this file holds
/// rules only - no EF (solid-scorecard finding 1).
/// </summary>
public sealed partial class ValuationReconciliationService(
    IValuationReconciliationRepository repo,
    IValuationReportFreezeGate freeze,
    ICaseStudyLookup caseStudy,
    IAuditLogWriter audit,
    IAuditLogAppend auditLog,
    IValuationComparableSelectionService selections,
    IValuationCostApproachService costApproach,
    TimeProvider? time = null) : IValuationReconciliationService
{
    private readonly TimeProvider _time = time ?? TimeProvider.System;

    public async Task<ValuationReconciliationDto?> GetAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken = default)
    {
        var vr = await repo.GetRequestAsync(valuationRequestId, cancellationToken);
        if (vr is null) return null;

        var market = await selections.ListAsync(valuationRequestId, cancellationToken);
        var cost = await costApproach.GetAsync(valuationRequestId, cancellationToken);
        var entity = await repo.GetWithMethodsAsync(valuationRequestId, cancellationToken);

        var workOrder = await ResolveWorkOrderValuationAsync(vr, cancellationToken);
        var uses = await repo.ListValueDocumentUsesAsync(valuationRequestId, tracked: false, cancellationToken);
        return ToDto(
            vr,
            market?.MarketOpinionValue ?? 0m,
            cost?.CostOpinionWithLand ?? 0m,
            entity,
            await GetEnabledKindsAsync(vr, cancellationToken),
            uses,
            workOrder.AssignmentType,
            workOrder.BasisOfValueKey,
            workOrder.ValuePremiseKey);
    }

    public async Task<IReadOnlyList<string>> GetEnabledApproachKindsAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken = default)
    {
        var vr = await repo.GetRequestAsync(valuationRequestId, cancellationToken);
        return vr is null ? [] : await GetEnabledKindsAsync(vr, cancellationToken);
    }

 /// <summary>Q-2: a disabled approach neither shows a row nor enters the weight.</summary>
    private async Task<IReadOnlyList<string>> GetEnabledKindsAsync(
        ValuationRequest vr,
        CancellationToken cancellationToken)
    {
        var settings = await repo.GetApproachSettingsAsync(vr.Id, cancellationToken);
        var hasStructures = false;
        var effectivePropertyType = vr.PropertyType;
        var propertyGuid = vr.PropertyId;
        if (propertyGuid != Guid.Empty)
        {
            var context = await caseStudy.GetValuationPropertyContextAsync(
                propertyGuid,
                cancellationToken);
            hasStructures = string.Equals(
                context?.HasStructuresToValue.Trim(),
                "yes",
                StringComparison.OrdinalIgnoreCase);
            effectivePropertyType =
                context?.EffectivePropertyType() ?? vr.PropertyType;
        }

        settings ??= ValuationApproachSettingsRules.Defaults(
            vr.Id,
            effectivePropertyType,
            hasStructures);
        var costEnabled = settings.CostApproachEnabled
            && ValuationApproachSettingsRules.CostApproachApplies(
                effectivePropertyType,
                hasStructures,
                settings.CostScopeKey);
        return ValuationApproachSettingsRules.EnabledReconciliationKinds(
            settings.MarketApproachEnabled,
            costEnabled);
    }

    private async Task<(AssignmentType AssignmentType, string? BasisOfValueKey, string? ValuePremiseKey)>
        ResolveWorkOrderValuationAsync(
            ValuationRequest vr,
            CancellationToken cancellationToken)
    {
        var propertyGuid = vr.PropertyId;
        if (propertyGuid == Guid.Empty)
            return (AssignmentType.Execution, null, null);
        var context = await caseStudy.GetValuationPropertyContextAsync(propertyGuid, cancellationToken);
        return (
            context?.AssignmentTypeValue() ?? AssignmentType.Execution,
            TrimOrNull(context?.BasisOfValueKey),
            TrimOrNull(context?.ValuePremiseKey));
    }

    private static string? TrimOrNull(string? value)
    {
        var trimmed = value?.Trim();
        return string.IsNullOrEmpty(trimmed) ? null : trimmed;
    }

    public async Task<(ValuationReconciliationDto? Result, Dictionary<string, string>? Errors)> SaveAsync(
        Guid valuationRequestId,
        SaveValuationReconciliationRequest request,
        string? actorId = null,
        CancellationToken cancellationToken = default)
    {
        var vr = await repo.GetRequestAsync(valuationRequestId, cancellationToken);
        if (vr is null)
            return (null, new Dictionary<string, string> { ["_"] = "طلب التقييم غير موجود" });
        if (vr.Status == ValuationRequestStatus.Done)
            return (null, new Dictionary<string, string> { ["_"] = "طلب التقييم مكتمل" });
        // Q-6: after deposit copy, the full report is frozen — only code and certificate are outside the freeze.
        var frozenMessage = await freeze.GetFrozenMessageAsync(vr.Id, vr.PropertyId, cancellationToken);
        if (frozenMessage is not null)
        {
            return (
                null,
                new Dictionary<string, string> { ["_"] = frozenMessage });
        }

        // Deed/nature match (traditional deed) is enforced at issuance only — the appraiser may
        // reconcile and save before the specialist settles the match.

        // "Blocking happens at adoption only — partial input is kept as draft":
        // Rationales and weight totals are enforced by issuance gates and alerts, not by save.
        var methods = NormalizeSoleMethod((request.Methods ?? []).ToList());
        var errors = new Dictionary<string, string>();

        if (request.FinalRoundDecimals is < 0 or > 6)
            errors["finalRoundDecimals"] = "أسّ التقريب يجب أن يكون بين 0 و 6 (تقريب لأقرب ١٠^ن ريال)";

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

        // Interactive model spec: discount follows the "liquidation value" basis directly;
        // an unset premise is auto-filled with "forced sale".
        if (string.Equals(basisKey, BasisOfValueKeys.Liquidation, StringComparison.Ordinal)
            && premiseKey is null)
        {
            premiseKey = ValuePremiseKeys.Forced;
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
        // Document indicators («مستند ذو قيمة») are reconciled like approaches, at their entered value.
        var indicatorValues = (await repo.ListValueDocumentUsesAsync(valuationRequestId, tracked: false, cancellationToken))
            .Where(ValueDocumentUseRules.IsIndicator)
            .ToDictionary(
                u => ValueDocumentUseRules.ReconciliationKind(u.AttachmentId),
                u => u.Value,
                StringComparer.OrdinalIgnoreCase);

        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        for (var i = 0; i < methods.Count; i++)
        {
            var m = methods[i];
            if (ValueDocumentUseRules.IsDocumentKind(m.ApproachKind))
            {
                if (!indicatorValues.ContainsKey(m.ApproachKind.Trim()))
                    errors[$"methods[{i}].approachKind"] = "المستند لم يعد مؤشرًا لأسلوب — حدّث أثر المستندات ذات القيمة";
                else if (!seen.Add(m.ApproachKind.Trim().ToLowerInvariant()))
                    errors[$"methods[{i}].approachKind"] = "لا يُكرَّر الأسلوب";
            }
            else if (!ValuationApproachKinds.IsKnown(m.ApproachKind))
                errors[$"methods[{i}].approachKind"] = "أسلوب غير معروف";
            else if (!enabledKinds.Contains(m.ApproachKind.Trim().ToLowerInvariant(), StringComparer.OrdinalIgnoreCase))
                errors[$"methods[{i}].approachKind"] = "ق-2: الأسلوب غير مفعَّل في إعدادات التقييم فلا يدخل في الترجيح";
            else if (!seen.Add(m.ApproachKind.Trim().ToLowerInvariant()))
                errors[$"methods[{i}].approachKind"] = "لا يُكرَّر الأسلوب";

            if (m.WeightPct is < 0m or > 100m)
                errors[$"methods[{i}].weightPct"] = "نسبة المشاركة يجب أن تكون بين 0 و 100";
        }

        if (errors.Count > 0) return (null, errors);

        var market = await selections.ListAsync(valuationRequestId, cancellationToken);
        var cost = await costApproach.GetAsync(valuationRequestId, cancellationToken);
        var marketValue = market?.MarketOpinionValue ?? 0m;
        var costValue = cost?.CostOpinionWithLand ?? 0m;

        var entity = await repo.FindWithMethodsAsync(valuationRequestId, cancellationToken);
        if (entity is null)
        {
            entity = new ValuationReconciliation
            {
                Id = Guid.NewGuid(),
                ValuationRequestId = valuationRequestId,
            };
            await repo.AddAsync(entity, cancellationToken);
        }

        // Upsert by approach kind — navigation-adds with pre-set GUIDs get marked
        // Modified by EF's graph heuristic (UPDATE 0 rows → global 409) on re-saves.
        var methodsByKind = entity.Methods
            .GroupBy(x => x.ApproachKind)
            .ToDictionary(g => g.Key, g => g.First());
        var keepKinds = new HashSet<string>();
        for (var i = 0; i < methods.Count; i++)
        {
            var m = methods[i];
            var kind = m.ApproachKind.Trim().ToLowerInvariant();
            var value = indicatorValues.TryGetValue(kind, out var documentValue)
                ? documentValue
                : string.Equals(kind, ValuationApproachKinds.Cost, StringComparison.Ordinal)
                    ? costValue
                    : marketValue;
            var sortOrder = m.SortOrder != 0 ? m.SortOrder : i;

            if (methodsByKind.TryGetValue(kind, out var row))
            {
                row.ApproachValue = value;
                row.WeightPct = m.WeightPct;
                row.Rationale = m.Rationale?.Trim() ?? "";
                row.IsIncluded = m.IsIncluded;
                row.SortOrder = sortOrder;
            }
            else
            {
                await repo.AddMethodLineAsync(
                    new ValuationReconciliationMethodLine
                    {
                        Id = Guid.NewGuid(),
                        ReconciliationId = entity.Id,
                        ApproachKind = kind,
                        ApproachValue = value,
                        WeightPct = m.WeightPct,
                        Rationale = m.Rationale?.Trim() ?? "",
                        IsIncluded = m.IsIncluded,
                        SortOrder = sortOrder,
                    },
                    cancellationToken);
            }
            keepKinds.Add(kind);
        }
        await repo.RemoveMethodLinesAsync(
            entity.Methods.Where(x => !keepKinds.Contains(x.ApproachKind)).ToList(),
            cancellationToken);

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
        entity.UpdatedAtUtc = _time.UtcNow();

        await repo.SaveChangesAsync(cancellationToken);

 // S2 : every alert pass — rationale or acknowledgement —
 // leaves an audit trail. Logged best-effort after the main save.
        if (!JsonTextEquality.SemanticallyEqual(previousOverridesJson, entity.MethodologyAlertOverridesJson))
        {
            await auditLog.AppendAsync(audit.Create(
                actorId: string.IsNullOrWhiteSpace(actorId) ? "unknown" : actorId,
                action: "valuation.alert-overrides.updated",
                entityType: "ValuationReconciliation",
                entityId: valuationRequestId.ToString("D"),
                before: ParseAlertOverrides(previousOverridesJson),
                after: alertOverrides), cancellationToken);
        }

        return (await GetAsync(valuationRequestId, cancellationToken), null);
    }

    private static List<SaveValuationReconciliationMethodRequest> NormalizeSoleMethod(
        List<SaveValuationReconciliationMethodRequest> methods)
    {
        if (methods.Count != 1)
            return methods;

        var sole = methods[0];
        var (weight, included) = ReconciliationRules.EffectiveParticipation(
            enabledKindCount: 1,
            savedWeightPct: sole.WeightPct,
            savedIsIncluded: sole.IsIncluded,
            liveValue: 1m,
            suggestedWeightPct: 0m);
        methods[0] = new SaveValuationReconciliationMethodRequest
        {
            Id = sole.Id,
            ApproachKind = sole.ApproachKind,
            WeightPct = weight,
            Rationale = sole.Rationale,
            IsIncluded = included,
            SortOrder = sole.SortOrder,
        };
        return methods;
    }
}
