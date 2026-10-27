// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 1 (5b554f4e)
//  • Income New file — what the issuance gates feed alerts 26–28 from the income approach (D17); the
//           cap-rate rationale typed on the income screen clears alert 26 unless a saved override exists.
// ──────────────────────────────────────────────────────────────────────────────────────────────

using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Valuation.Application.Rules;

/// <summary>D17 — what the issuance gates feed alerts 26–28 from the income approach. Pure.</summary>
public static class IncomeApproachAlertInputRules
{
    /// <summary>The income figures alerts 26–28 read; null while the approach is off or never saved.</summary>
    public static ValuationMethodologyAlertIncomeInput? AlertInput(ValuationIncomeApproachDto? income) =>
        income is null || !income.IsSaved
            ? null
            : new ValuationMethodologyAlertIncomeInput(
                income.GrossPotentialIncome,
                income.EffectiveGrossIncome,
                income.OperatingExpensesTotal,
                income.NetOperatingIncome,
                income.CapitalisationRatePct);

    /// <summary>
    /// The cap-rate rationale written on the income screen is the appraiser's explanation for
    /// alert 26 — it clears it without retyping it in the alerts panel; a saved override wins.
    /// </summary>
    public static void AddCapRateRationale(
        List<ValuationMethodologyAlertResolution> resolutions,
        ValuationIncomeApproachDto? income)
    {
        if (string.IsNullOrWhiteSpace(income?.CapRateRationale)
            || resolutions.Any(r => string.Equals(
                r.Code,
                ValuationMethodologyAlertCodes.CapRateOutOfRange,
                StringComparison.OrdinalIgnoreCase)))
        {
            return;
        }

        resolutions.Add(new ValuationMethodologyAlertResolution(
            ValuationMethodologyAlertCodes.CapRateOutOfRange,
            income.CapRateRationale));
    }
}
