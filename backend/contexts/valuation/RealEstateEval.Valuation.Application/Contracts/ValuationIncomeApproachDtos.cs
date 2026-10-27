// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 1 (5b554f4e)
//  • Income New file — D17 income approach DTO (gross income, vacancy %, EGI, operating expenses as amount
//           or % of EGI, NOI, cap rate, value = NOI ÷ cap rate, IsComplete) and its save request.
// ──────────────────────────────────────────────────────────────────────────────────────────────

namespace RealEstateEval.Valuation.Application.Contracts;

/// <summary>D17 — income approach (direct capitalisation): the appraiser's inputs and the derived chain.</summary>
public class ValuationIncomeApproachDto
{
    public Guid ValuationRequestId { get; init; }
    public string PropertyId { get; init; } = "";
    public bool IsSaved { get; init; }
    /// <summary>Enabled in the approach settings — the screen and the save follow it.</summary>
    public bool IncomeApproachEnabled { get; init; }

    public decimal GrossPotentialIncome { get; init; }
    public decimal VacancyCollectionLossPct { get; init; }
    public decimal VacancyLossAmount { get; init; }
    public decimal OtherIncome { get; init; }
    /// <summary>EGI = GPI × (1 − vacancy%) + other income.</summary>
    public decimal EffectiveGrossIncome { get; init; }

    /// <summary>amount | pct_of_egi.</summary>
    public string OperatingExpensesMode { get; init; } = "pct_of_egi";
    public decimal OperatingExpensesAmount { get; init; }
    public decimal OperatingExpensesPct { get; init; }
    /// <summary>The expenses that enter NOI (the amount, or EGI × %).</summary>
    public decimal OperatingExpensesTotal { get; init; }
    /// <summary>Expenses as % of EGI; null when EGI is zero.</summary>
    public decimal? OperatingExpensesPctOfEgi { get; init; }

    /// <summary>NOI = EGI − expenses.</summary>
    public decimal NetOperatingIncome { get; init; }
    public decimal? CapitalisationRatePct { get; init; }
    public string? CapRateRationale { get; init; }
    /// <summary>Value = NOI ÷ cap rate (0 until complete) — the reconciliation indicator.</summary>
    public decimal IncomeValue { get; init; }
    /// <summary>Gross income, a cap rate and a positive NOI — the issuance gate «أسلوب الدخل مكتمل».</summary>
    public bool IsComplete { get; init; }
    public string? UpdatedAtUtc { get; init; }
}

public class SaveValuationIncomeApproachRequest
{
    /// <summary>Annual SAR, 0 – 1,000,000,000.</summary>
    public decimal GrossPotentialIncome { get; init; }
    /// <summary>0–100.</summary>
    public decimal VacancyCollectionLossPct { get; init; }
    /// <summary>Annual SAR, 0 – 1,000,000,000.</summary>
    public decimal OtherIncome { get; init; }
    /// <summary>amount | pct_of_egi (default).</summary>
    public string? OperatingExpensesMode { get; init; }
    public decimal OperatingExpensesAmount { get; init; }
    /// <summary>0–100 of EGI.</summary>
    public decimal OperatingExpensesPct { get; init; }
    /// <summary>0 &lt; r ≤ 30; null keeps the draft without a rate.</summary>
    public decimal? CapitalisationRatePct { get; init; }
    public string? CapRateRationale { get; init; }
}
