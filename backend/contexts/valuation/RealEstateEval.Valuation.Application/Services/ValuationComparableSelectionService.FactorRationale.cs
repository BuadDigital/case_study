using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Domain;
using RealEstateEval.Valuation.Application.Abstractions;
using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Application.Rules;
using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Valuation.Application.Services;

public sealed partial class ValuationComparableSelectionService
{
 /// <summary>
 /// Q-8-1: save the single adjustment-factor rationale (covers all comparables) — empty clears it.
 /// </summary>
    public async Task<(ValuationAdjustmentFactorRationaleDto? Result, Dictionary<string, string>? Errors)>
        SaveFactorRationaleAsync(
            Guid valuationRequestId,
            SaveAdjustmentFactorRationaleRequest request,
            string? updatedByUserId,
            CancellationToken cancellationToken = default)
    {
        var vr = await repo.GetRequestAsync(valuationRequestId, cancellationToken);
        if (vr is null)
            return (null, new Dictionary<string, string> { ["_"] = "طلب التقييم غير موجود" });
        if (vr.Status == ValuationRequestStatus.Done)
            return (null, new Dictionary<string, string> { ["_"] = "طلب التقييم مكتمل — لا يمكن تعديل المبررات" });
        // Q-6: after deposit copy, the full report is frozen — only code and certificate are outside the freeze.
        if (await freeze.IsFrozenAsync(vr.Id, cancellationToken))
        {
            return (
                null,
                new Dictionary<string, string> { ["_"] = ValuationReportFreezeRules.FrozenMessageAr });
        }

        var approachSettings = await repo.GetApproachSettingsAsync(
            valuationRequestId, cancellationToken);
        if (approachSettings is { AdjustmentsEditUnlocked: false })
        {
            return (null, new Dictionary<string, string>
            {
                ["_"] = "صلاحية تحرير التسويات معطَّلة — تُفعَّل من إعدادات التقييم (شاشة 1)",
            });
        }

        var context = ComparableSelectionContexts.Normalize(request.SelectionContext);
        var factorKey = request.FactorKey.Trim();
        if (factorKey.Length == 0)
            return (null, new Dictionary<string, string> { ["factorKey"] = "مفتاح العامل مطلوب" });

        var rationale = request.RationaleAr?.Trim() ?? "";

        var row = await repo.FindFactorRationaleAsync(
            valuationRequestId, context, factorKey, cancellationToken);

        if (rationale.Length == 0)
        {
            if (row is not null)
            {
                await repo.RemoveFactorRationaleAsync(row, cancellationToken);
                await repo.SaveChangesAsync(cancellationToken);
            }

            return (new ValuationAdjustmentFactorRationaleDto
            {
                SelectionContext = context,
                FactorKey = factorKey,
                RationaleAr = "",
            }, null);
        }

        if (row is null)
        {
            row = new ValuationAdjustmentFactorRationale
            {
                Id = Guid.NewGuid(),
                ValuationRequestId = valuationRequestId,
                SelectionContext = context,
                FactorKey = factorKey,
            };
            await repo.AddFactorRationaleAsync(row, cancellationToken);
        }

        row.RationaleAr = rationale;
        row.UpdatedAtUtc = _time.UtcNow();
        row.UpdatedByUserId = updatedByUserId;
        await repo.SaveChangesAsync(cancellationToken);

        return (new ValuationAdjustmentFactorRationaleDto
        {
            SelectionContext = context,
            FactorKey = factorKey,
            RationaleAr = rationale,
        }, null);
    }
}
