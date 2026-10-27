// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 1 (5b554f4e)
//  • Alerts New file — problem 20: the alert dispositions are saved on their own (SaveAlertOverridesAsync,
//           upsert by code via MergeAlertOverrides, audited), so an acknowledgement no longer waits on
//           «مبرر استخدام طرق التقييم».
//  • D3   ReconciliationLiquidationMessages — one name for the liquidation discount, «خصم التصفية».
// Hotfix (9acb4f54)
//  • D1   A row created by an acknowledgement starts from the work order's basis and premise, not the
//         default «market» — liquidation cases no longer turn into market value.
// Round 2 (1b19bedc)
//  • R2-10 A blank or unknown alert code is refused with an Arabic 400 (AddAlertOverrideCodeErrors).
//  • B    A written override rationale is at least 10 characters (AddAlertOverrideRationaleErrors).
//  • R2-8 Liquidation discount capped at 90% (MaxDiscountPct); its name and the report labels follow the
//         premise: «خصم التصفية المنظمة» / «خصم البيع القسري» (DiscountLabelAr, ReportFieldLabelAr).
// ──────────────────────────────────────────────────────────────────────────────────────────────

using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Domain;
using RealEstateEval.Valuation.Application.Abstractions;
using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Valuation.Application.Services;

/// <summary>
/// Problem 20: the methodology-alert dispositions are saved on their own. The full reconciliation
/// save requires «مبرر استخدام طرق التقييم», so routing an acknowledgement through it refused the
/// acknowledgement until the appraiser had written the final-opinion rationale.
/// </summary>
public sealed partial class ValuationReconciliationService
{
    public async Task<(ValuationReconciliationDto? Result, Dictionary<string, string>? Errors)> SaveAlertOverridesAsync(
        Guid valuationRequestId,
        SaveValuationAlertOverridesRequest request,
        string? actorId = null,
        CancellationToken cancellationToken = default)
    {
        var vr = await repo.GetRequestAsync(valuationRequestId, cancellationToken);
        if (vr is null)
            return (null, new Dictionary<string, string> { ["_"] = "طلب التقييم غير موجود" });
        var blocked = await freeze.GetWriteBlockedMessageAsync(vr, "طلب التقييم مكتمل", cancellationToken);
        if (blocked is not null)
            return (null, new Dictionary<string, string> { ["_"] = blocked });

        var entity = await repo.FindWithMethodsAsync(valuationRequestId, cancellationToken);
        if (entity is null)
        {
            // The saved basis wins over the work order (D1), so a row created by an acknowledgement
            // starts from the work order's basis and premise — never the class default «market».
            var workOrder = await ResolveWorkOrderValuationAsync(vr, cancellationToken);
            entity = new ValuationReconciliation
            {
                Id = Guid.NewGuid(),
                ValuationRequestId = valuationRequestId,
                BasisOfValueKey = FirstValuationKey(
                    workOrder.BasisOfValueKey,
                    AssignmentValuationDefaults.BasisOfValueKey(workOrder.AssignmentType)),
                ValuePremiseKey = TrimOrNull(FirstValuationKey(
                    workOrder.ValuePremiseKey,
                    AssignmentValuationDefaults.PremiseKey(workOrder.AssignmentType))),
            };
            await repo.AddAsync(entity, cancellationToken);
        }

        var incoming = NormalizeAlertOverrides(request.MethodologyAlertOverrides);
        var errors = new Dictionary<string, string>();
        AddAlertOverrideCodeErrors(request.MethodologyAlertOverrides, errors);
        AddAlertOverrideRationaleErrors(incoming, errors);
        if (errors.Count > 0) return (null, errors);

        var previousOverridesJson = entity.MethodologyAlertOverridesJson;
        var merged = MergeAlertOverrides(
            ParseAlertOverrides(previousOverridesJson),
            incoming);
        entity.MethodologyAlertOverridesJson = merged.Count == 0
            ? null
            : System.Text.Json.JsonSerializer.Serialize(merged, AlertOverridesJsonOptions);
        entity.UpdatedAtUtc = _time.UtcNow();
        await repo.SaveChangesAsync(cancellationToken);

        if (!RealEstateEval.Application.Rules.JsonTextEquality.SemanticallyEqual(
                previousOverridesJson, entity.MethodologyAlertOverridesJson))
        {
            await auditLog.AppendAsync(audit.Create(
                actorId: string.IsNullOrWhiteSpace(actorId) ? "unknown" : actorId,
                action: "valuation.alert-overrides.updated",
                entityType: "ValuationReconciliation",
                entityId: valuationRequestId.ToString("D"),
                before: ParseAlertOverrides(previousOverridesJson),
                after: merged), cancellationToken);
        }

        return (await GetAsync(valuationRequestId, cancellationToken), null);
    }

    public const string AlertCodeRequiredAr = "رمز التنبيه مطلوب";
    public const string AlertCodeUnknownAr = "رمز تنبيه منهجي غير معروف";

    /// <summary>
    /// Round 2: a disposition for a blank or unknown alert code («xyz») is refused with an Arabic 400
    /// — it used to be dropped (blank) or stored where no alert ever reads it (unknown).
    /// </summary>
    public static void AddAlertOverrideCodeErrors(
        IReadOnlyList<ValuationMethodologyAlertOverrideDto>? overrides,
        Dictionary<string, string> errors)
    {
        var items = overrides ?? [];
        for (var i = 0; i < items.Count; i++)
        {
            var code = items[i]?.Code;
            if (string.IsNullOrWhiteSpace(code))
                errors[$"methodologyAlertOverrides[{i}].code"] = AlertCodeRequiredAr;
            else if (!ValuationMethodologyAlertCodes.IsAcceptedForDisposition(code))
                errors[$"methodologyAlertOverrides[{i}].code"] = $"{AlertCodeUnknownAr}: «{code.Trim()}»";
        }
    }

    /// <summary>Decision B: a written override rationale is at least 10 characters (blank = acknowledgement only / clear).</summary>
    public static void AddAlertOverrideRationaleErrors(
        IReadOnlyList<ValuationMethodologyAlertOverrideDto> overrides,
        Dictionary<string, string> errors)
    {
        foreach (var o in overrides)
        {
            if (JustificationRules.IsBelowRequiredMinimum(o.OverrideRationale))
                errors[$"methodologyAlertOverrides.{o.Code.Trim()}"] =
                    JustificationRules.RequiredMinimumMessageAr("مبرر تجاوز التنبيه");
        }
    }

    /// <summary>Upsert by code; a disposition with neither rationale nor acknowledgement is dropped.</summary>
    public static List<ValuationMethodologyAlertOverrideDto> MergeAlertOverrides(
        IReadOnlyList<ValuationMethodologyAlertOverrideDto> stored,
        IReadOnlyList<ValuationMethodologyAlertOverrideDto> incoming)
    {
        var byCode = new Dictionary<string, ValuationMethodologyAlertOverrideDto>(StringComparer.OrdinalIgnoreCase);
        foreach (var o in stored.Where(o => !string.IsNullOrWhiteSpace(o.Code)))
            byCode[o.Code.Trim()] = o;
        foreach (var o in incoming)
            byCode[o.Code.Trim()] = o;
        return byCode.Values
            .Where(o => o.Acknowledged || !string.IsNullOrWhiteSpace(o.OverrideRationale))
            .ToList();
    }
}

/// <summary>
/// D3: the reconciliation's liquidation-discount messages, one name throughout — «خصم التصفية».
/// </summary>
public static class ReconciliationLiquidationMessages
{
    /// <summary>The server ceiling — the same 90٪ the final-opinion screen allows.</summary>
    public const decimal MaxDiscountPct = 90m;

    /// <summary>The discount's name follows the premise: «التصفية المنظمة» / «البيع القسري».</summary>
    public static string DiscountLabelAr(string? premiseKey) =>
        (premiseKey ?? "").Trim().ToLowerInvariant() switch
        {
            ValuePremiseKeys.Orderly => "خصم التصفية المنظمة",
            ValuePremiseKeys.Forced => "خصم البيع القسري",
            _ => "خصم التصفية",
        };

    /// <summary>
    /// Round 2: the report's liquidation field labels follow the premise too — the catalog's generic
    /// «نسبة البيع القصري» / «… بدون البيع القصري» printed on an orderly-liquidation report. Null for
    /// any other field (its catalog label stands).
    /// </summary>
    public static string? ReportFieldLabelAr(string fieldKey, string? premiseKey) => fieldKey switch
    {
        "final.liquidation_discount_pct" => $"نسبة {DiscountLabelAr(premiseKey)}",
        "final.opinion_before_liquidation" => $"القيمة النهائية قبل {DiscountLabelAr(premiseKey)}",
        _ => null,
    };

    public static string RangeMessageAr(string? premiseKey) =>
        $"نسبة {DiscountLabelAr(premiseKey)} يجب أن تكون بين 0 و 90";

    public const string OnlyForLiquidationAr = "خصم التصفية يُطبَّق فقط عند أساس القيمة «قيمة التصفية»";
    public const string RequiredForLiquidationAr =
        "أساس القيمة «قيمة التصفية» يتطلب نسبة خصم التصفية أكبر من صفر";
    public const string RationaleRequiredAr = "مبرر خصم التصفية مطلوب عند إدخال نسبة";
}
