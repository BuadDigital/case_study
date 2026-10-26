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

        var previousOverridesJson = entity.MethodologyAlertOverridesJson;
        var merged = MergeAlertOverrides(
            ParseAlertOverrides(previousOverridesJson),
            NormalizeAlertOverrides(request.MethodologyAlertOverrides));
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
    public const string RangeAr = "نسبة خصم التصفية يجب أن تكون بين 0 و 100";
    public const string OnlyForLiquidationAr = "خصم التصفية يُطبَّق فقط عند أساس القيمة «قيمة التصفية»";
    public const string RequiredForLiquidationAr =
        "أساس القيمة «قيمة التصفية» يتطلب نسبة خصم التصفية أكبر من صفر";
    public const string RationaleRequiredAr = "مبرر خصم التصفية مطلوب عند إدخال نسبة";
}
