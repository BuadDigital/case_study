namespace RealEstateEval.Valuation.Domain;

/// <summary>
/// D17 — income approach by direct capitalisation, one row per valuation request:
/// EGI = GPI × (1 − vacancy%) + other income; NOI = EGI − operating expenses; value = NOI ÷ cap rate.
/// Only the appraiser's inputs are stored — every derived figure is recomputed on read.
/// </summary>
public class ValuationIncomeApproach
{
    public Guid Id { get; set; }
    public Guid ValuationRequestId { get; set; }
    /// <summary>Gross potential income — annual SAR at full occupancy.</summary>
    public decimal GrossPotentialIncome { get; set; }
    /// <summary>Vacancy and collection loss % of the gross potential income (0–100).</summary>
    public decimal VacancyCollectionLossPct { get; set; }
    /// <summary>Other annual income (parking, advertising…) added after the vacancy loss.</summary>
    public decimal OtherIncome { get; set; }
    /// <summary>How operating expenses are entered — see <see cref="OperatingExpenseModes"/>.</summary>
    public string OperatingExpensesMode { get; set; } = OperatingExpenseModes.PctOfEgi;
    /// <summary>Annual operating expenses in SAR (amount mode).</summary>
    public decimal OperatingExpensesAmount { get; set; }
    /// <summary>Operating expenses as % of the effective gross income (percent mode, 0–100).</summary>
    public decimal OperatingExpensesPct { get; set; }
    /// <summary>Capitalisation rate % (0 &lt; r ≤ 30); null until the appraiser enters it.</summary>
    public decimal? CapitalisationRatePct { get; set; }
    /// <summary>The appraiser's basis for the cap rate (market evidence) — printed with the section.</summary>
    public string? CapRateRationale { get; set; }
    public DateTime UpdatedAtUtc { get; set; }

    public ValuationRequest? ValuationRequest { get; set; }
}

/// <summary>Operating expenses: a typed annual amount, or a % of the effective gross income.</summary>
public static class OperatingExpenseModes
{
    public const string Amount = "amount";
    public const string PctOfEgi = "pct_of_egi";

    public static readonly string[] All = [Amount, PctOfEgi];

    public static bool IsKnown(string? value) =>
        (value ?? "").Trim().ToLowerInvariant() is Amount or PctOfEgi;

    public static string Normalize(string? value) =>
        (value ?? "").Trim().ToLowerInvariant() == Amount ? Amount : PctOfEgi;
}

/// <summary>Direct-capitalisation arithmetic and its bounds — decimal, half away from zero, 2 places.</summary>
public static class IncomeApproachRules
{
    /// <summary>Upper bound of the cap rate (%); the lower bound is exclusive zero.</summary>
    public const decimal MaxCapRatePct = 30m;
    /// <summary>Largest annual amount (GPI / other income / expenses) one valuation may carry (SAR).</summary>
    public const decimal MaxAnnualAmountSar = 1_000_000_000m;
    public const int RationaleMaxLength = 2000;

    /// <summary>Alert 26 — cap rates outside this band need a written rationale.</summary>
    public const decimal TypicalCapRateMinPct = 4m;
    public const decimal TypicalCapRateMaxPct = 12m;
    /// <summary>Alert 27 — operating expenses above this share of EGI need an acknowledgement.</summary>
    public const decimal HighOpexPctOfEgi = 50m;

    private static decimal R2(decimal value) => Math.Round(value, 2, MidpointRounding.AwayFromZero);

    /// <summary>GPI × vacancy% — the income lost to vacancy and collection.</summary>
    public static decimal VacancyLoss(decimal grossPotentialIncome, decimal vacancyPct) =>
        R2(Math.Max(0m, grossPotentialIncome) * Math.Clamp(vacancyPct, 0m, 100m) / 100m);

    /// <summary>EGI = GPI × (1 − vacancy%) + other income.</summary>
    public static decimal EffectiveGrossIncome(decimal grossPotentialIncome, decimal vacancyPct, decimal otherIncome) =>
        R2(Math.Max(0m, grossPotentialIncome) - VacancyLoss(grossPotentialIncome, vacancyPct) + Math.Max(0m, otherIncome));

    /// <summary>Annual operating expenses — the typed amount, or EGI × the typed %.</summary>
    public static decimal OperatingExpenses(string? mode, decimal amount, decimal pctOfEgi, decimal effectiveGrossIncome) =>
        OperatingExpenseModes.Normalize(mode) == OperatingExpenseModes.Amount
            ? R2(Math.Max(0m, amount))
            : R2(Math.Max(0m, effectiveGrossIncome) * Math.Clamp(pctOfEgi, 0m, 100m) / 100m);

    /// <summary>Expenses as % of EGI (alert 27); null when EGI is zero.</summary>
    public static decimal? OperatingExpensesPctOfEgi(decimal operatingExpenses, decimal effectiveGrossIncome) =>
        effectiveGrossIncome > 0m ? R2(operatingExpenses / effectiveGrossIncome * 100m) : null;

    /// <summary>NOI = EGI − operating expenses (may be negative — alert 28).</summary>
    public static decimal NetOperatingIncome(decimal effectiveGrossIncome, decimal operatingExpenses) =>
        R2(effectiveGrossIncome - operatingExpenses);

    /// <summary>Value = NOI ÷ (cap rate ÷ 100); zero while NOI or the cap rate is not positive.</summary>
    public static decimal CapitalisedValue(decimal netOperatingIncome, decimal? capRatePct)
    {
        if (netOperatingIncome <= 0m || capRatePct is not > 0m) return 0m;
        return R2(netOperatingIncome / (capRatePct.Value / 100m));
    }

    /// <summary>The indicator can enter the reconciliation: income, a cap rate and a positive NOI.</summary>
    public static bool IsComplete(decimal grossPotentialIncome, decimal? capRatePct, decimal netOperatingIncome) =>
        grossPotentialIncome > 0m && capRatePct is > 0m && netOperatingIncome > 0m;

    /// <summary>Alert 26 — outside the typical 4–12٪ band.</summary>
    public static bool CapRateOutsideTypicalRange(decimal capRatePct) =>
        capRatePct < TypicalCapRateMinPct || capRatePct > TypicalCapRateMaxPct;

    /// <summary>Alert 27 — expenses above half of the effective gross income.</summary>
    public static bool OpexAboveHalfOfEgi(decimal opexPctOfEgi) => opexPctOfEgi > HighOpexPctOfEgi;
}
