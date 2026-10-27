// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 1 (5b554f4e)
//  • Income New file — pure validation of the income-approach save (D17): amounts 0–1e9 SAR, % 0–100,
//           known expenses mode, cap rate > 0 and ≤ the maximum, rationale length; Arabic 400s, never a 500.
// Round 2 (1b19bedc)
//  • B    When alert 26 fires (cap rate outside 4–12%) a written cap-rate rationale is at least 10 characters.
// ──────────────────────────────────────────────────────────────────────────────────────────────

using System.Globalization;
using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Valuation.Application.Rules;

/// <summary>
/// Pure request validation for the income-approach save (D17) — bounds with Arabic messages,
/// run before anything is loaded so an absurd payload is a 400, never a 500.
/// </summary>
public static class ValuationIncomeApproachRequestRules
{
    public static Dictionary<string, string> Validate(SaveValuationIncomeApproachRequest request)
    {
        var errors = new Dictionary<string, string>();
        Amount(errors, "grossPotentialIncome", "الدخل الإجمالي المحتمل", request.GrossPotentialIncome);
        Pct(errors, "vacancyCollectionLossPct", "نسبة الشغور وخسائر التحصيل", request.VacancyCollectionLossPct);
        Amount(errors, "otherIncome", "الدخل الآخر", request.OtherIncome);

        if (request.OperatingExpensesMode is { } mode && mode.Trim().Length > 0
            && !OperatingExpenseModes.IsKnown(mode))
        {
            errors["operatingExpensesMode"] = "طريقة إدخال مصروفات التشغيل غير معروفة (مبلغ / نسبة من الدخل الفعلي)";
        }
        Amount(errors, "operatingExpensesAmount", "مصروفات التشغيل", request.OperatingExpensesAmount);
        Pct(errors, "operatingExpensesPct", "نسبة مصروفات التشغيل", request.OperatingExpensesPct);

        if (request.CapitalisationRatePct is { } cap
            // Stored to 4 places: a rate that rounds to zero would divide by zero on every read.
            && (Math.Round(cap, 4, MidpointRounding.AwayFromZero) <= 0m || cap > IncomeApproachRules.MaxCapRatePct))
        {
            errors["capitalisationRatePct"] =
                $"معدل الرسملة يجب أن يكون أكبر من 0 ولا يتجاوز {N(IncomeApproachRules.MaxCapRatePct)}٪";
        }

        if ((request.CapRateRationale?.Trim().Length ?? 0) > IncomeApproachRules.RationaleMaxLength)
            errors["capRateRationale"] = $"مبرر معدل الرسملة لا يتجاوز {N(IncomeApproachRules.RationaleMaxLength)} حرف";
        // Decision B: when alert 26 fires (rate outside 4–12٪) a written rationale is at least 10 characters.
        else if (request.CapitalisationRatePct is { } rate
                 && IncomeApproachRules.CapRateOutsideTypicalRange(rate)
                 && JustificationRules.IsBelowRequiredMinimum(request.CapRateRationale))
            errors["capRateRationale"] = JustificationRules.RequiredMinimumMessageAr("مبرر معدل الرسملة");
        return errors;
    }

    private static void Amount(Dictionary<string, string> errors, string key, string labelAr, decimal value)
    {
        if (value < 0m)
            errors[key] = $"{labelAr} يجب أن يكون ≥ 0";
        else if (value > IncomeApproachRules.MaxAnnualAmountSar)
            errors[key] = $"{labelAr} يتجاوز الحد المعقول ({N(IncomeApproachRules.MaxAnnualAmountSar)} ر.س سنويًا)";
    }

    private static void Pct(Dictionary<string, string> errors, string key, string labelAr, decimal value)
    {
        if (value is < 0m or > 100m)
            errors[key] = $"{labelAr} يجب أن تكون بين 0 و 100";
    }

    /// <summary>Latin digits, comma thousands — whatever the server culture.</summary>
    private static string N(decimal value) => value.ToString("#,0", CultureInfo.InvariantCulture);
}
