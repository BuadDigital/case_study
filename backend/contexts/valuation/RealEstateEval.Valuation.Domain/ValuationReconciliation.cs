namespace RealEstateEval.Domain;

/// <summary>Approach kinds that can participate in reconciliation (income deferred).</summary>
public static class ValuationApproachKinds
{
    public const string Market = "market";
    public const string Cost = "cost";

    public static bool IsKnown(string? kind) =>
        string.Equals(kind, Market, StringComparison.OrdinalIgnoreCase)
        || string.Equals(kind, Cost, StringComparison.OrdinalIgnoreCase);

    public static string LabelAr(string kind) =>
        string.Equals(kind, Cost, StringComparison.OrdinalIgnoreCase)
            ? "أسلوب التكلفة"
            : "أسلوب المقارنة (السوق)";
}

/// <summary>8 bases.</summary>
public static class BasisOfValueKeys
{
    public const string Market = "market";
    public const string MarketRent = "market_rent";
    public const string Equitable = "equitable";
    public const string Investment = "investment";
    public const string Synergistic = "synergistic";
    public const string Liquidation = "liquidation";
    public const string FairIfrs = "fair_ifrs";
    public const string FairStatutory = "fair_statutory";

    public static readonly string[] All =
    [
        Market, MarketRent, Equitable, Investment, Synergistic,
        Liquidation, FairIfrs, FairStatutory,
    ];

    public static bool IsKnown(string? key) =>
        All.Contains((key ?? "").Trim(), StringComparer.OrdinalIgnoreCase);

    public static string LabelAr(string? key) =>
        (key ?? "").Trim().ToLowerInvariant() switch
        {
            Market => "القيمة السوقية",
            MarketRent => "الإيجار السوقي",
            Equitable => "القيمة المنصفة",
            Investment => "القيمة الاستثمارية",
            Synergistic => "القيمة التكاملية",
            Liquidation => "قيمة التصفية",
            FairIfrs => "القيمة العادلة (IFRS)",
            FairStatutory => "القيمة العادلة (القانونية/التشريعية)",
            _ => string.IsNullOrWhiteSpace(key) ? "" : key.Trim(),
        };

 /// <summary>
 /// Word-merge field 9263 label: liquidation×premise → compound name; else basis label.
 /// </summary>
    public static string InjectionLabelAr(string? basisKey, string? premiseKey)
    {
        var basis = (basisKey ?? "").Trim().ToLowerInvariant();
        var premise = (premiseKey ?? "").Trim().ToLowerInvariant();
        if (basis == Liquidation)
        {
            if (premise == ValuePremiseKeys.Orderly) return "التصفية المنظمة";
            if (premise == ValuePremiseKeys.Forced) return "البيع القسري";
        }

        return LabelAr(basis);
    }
}

/// <summary>4 premises.</summary>
public static class ValuePremiseKeys
{
    public const string HighestAndBest = "hau";
    public const string CurrentUse = "current";
    public const string Orderly = "orderly";
    public const string Forced = "forced";

    public static readonly string[] All = [HighestAndBest, CurrentUse, Orderly, Forced];
    public static readonly string[] LiquidationPremises = [Orderly, Forced];
    public static readonly string[] NonLiquidationPremises = [HighestAndBest, CurrentUse];

    public static bool IsKnown(string? key) =>
        All.Contains((key ?? "").Trim(), StringComparer.OrdinalIgnoreCase);

    public static string LabelAr(string? key) =>
        (key ?? "").Trim().ToLowerInvariant() switch
        {
            HighestAndBest => "أعلى وأفضل استخدام",
            CurrentUse => "الاستخدام الحالي",
            Orderly => "التصفية المنظمة",
            Forced => "البيع القسري",
            _ => string.IsNullOrWhiteSpace(key) ? "" : key.Trim(),
        };

 /// <summary>
 /// Liquidation basis pairs only with orderly/forced; other bases with HBU/current use.
 /// </summary>
    public static bool IsCompatible(string? basisKey, string? premiseKey)
    {
        if (string.IsNullOrWhiteSpace(premiseKey)) return true;
        if (!IsKnown(premiseKey)) return false;
        var premise = premiseKey.Trim().ToLowerInvariant();
        var liquidation = string.Equals(
            basisKey?.Trim(),
            BasisOfValueKeys.Liquidation,
            StringComparison.OrdinalIgnoreCase);
        return liquidation
            ? LiquidationPremises.Contains(premise, StringComparer.Ordinal)
            : NonLiquidationPremises.Contains(premise, StringComparer.Ordinal);
    }
}

/// <summary>
/// Final opinion reconciliation header.
/// Liquidation discount applies only when basis = liquidation.
/// </summary>
public class ValuationReconciliation
{
    public Guid Id { get; set; }
    public Guid ValuationRequestId { get; set; }
 /// <summary>مبرر استخدام طرق التقييم — required when saving.</summary>
    public string MethodsRationale { get; set; } = "";
 /// <summary>Rounding applied once on the final opinion (no earlier rounding).</summary>
    public int FinalRoundDecimals { get; set; }
 /// <summary>Basis of value key — see <see cref="BasisOfValueKeys"/>.</summary>
    public string BasisOfValueKey { get; set; } = BasisOfValueKeys.Market;
 /// <summary>Value premise when basis is liquidation — see <see cref="ValuePremiseKeys"/>.</summary>
    public string? ValuePremiseKey { get; set; }
    public decimal LiquidationDiscountPct { get; set; }
    public string? LiquidationDiscountRationale { get; set; }
 /// <summary>JSON — soft methodology-alert overrides (rationale / ack).</summary>
    public string? MethodologyAlertOverridesJson { get; set; }
    public DateTime UpdatedAtUtc { get; set; }

    public ValuationRequest? ValuationRequest { get; set; }
    public ICollection<ValuationReconciliationMethodLine> Methods { get; set; } = [];
}

/// <summary>One row per applied approach in the participation table.</summary>
public class ValuationReconciliationMethodLine
{
    public Guid Id { get; set; }
    public Guid ReconciliationId { get; set; }
    public string ApproachKind { get; set; } = ValuationApproachKinds.Market;
 /// <summary>Approach opinion snapshotted at save (market / cost with land).</summary>
    public decimal ApproachValue { get; set; }
    public decimal WeightPct { get; set; }
    public string Rationale { get; set; } = "";
    public bool IsIncluded { get; set; } = true;
    public int SortOrder { get; set; }

    public ValuationReconciliation? Reconciliation { get; set; }
}

public static class ReconciliationRules
{
    public const decimal WeightSumTolerance = 0.05m;

 /// <summary>
 /// Unrounded contribution — مواصفة النموذج التفاعلي: القيمة كما هي بلا تصفير للسالب؛
 /// المؤشر غير المكتمل/السالب يحجبه الاعتماد لا الجمع.
 /// </summary>
    public static decimal Contribution(decimal approachValue, decimal weightPct) =>
        approachValue * (weightPct / 100m);

    public static decimal WeightedValue(
        IEnumerable<(decimal value, decimal weightPct, bool included)> methods) =>
        methods.Where(m => m.included).Sum(m => Contribution(m.value, m.weightPct));

    public static bool WeightsSumTo100(IEnumerable<decimal> includedWeights)
    {
        var sum = includedWeights.Sum();
        return Math.Abs(sum - 100m) <= WeightSumTolerance;
    }

 /// <summary>
 /// Round once on the final opinion — مواصفة النموذج التفاعلي:
 /// finalVal = round(القيمة / 10^ن) × 10^ن (ن=0 أقرب ريال؛ ن=4 أقرب ١٠٬٠٠٠).
 /// </summary>
    public static decimal RoundFinal(decimal weightedValue, int decimals)
    {
        var d = Math.Clamp(decimals, 0, 6);
        if (d == 0)
            return Math.Round(weightedValue, MidpointRounding.AwayFromZero);
        var power = 1m;
        for (var i = 0; i < d; i++) power *= 10m;
        return Math.Round(weightedValue / power, MidpointRounding.AwayFromZero) * power;
    }

 /// <summary>
 /// مواصفة النموذج التفاعلي: خصم البيع القسري لا يُفعَّل إلا مع «قيمة التصفية» —
 /// اختيار الأساس وحده يكفي (الفرضية بيانات وصفية لا شرط تطبيق).
 /// </summary>
    public static bool ShouldApplyLiquidationDiscount(
        string? basisOfValueKey,
        string? valuePremiseKey,
        decimal discountPct)
    {
        _ = valuePremiseKey;
        return discountPct > 0m
            && string.Equals(
                basisOfValueKey?.Trim(),
                BasisOfValueKeys.Liquidation,
                StringComparison.OrdinalIgnoreCase);
    }

    public static decimal ApplyLiquidationDiscount(decimal valueBeforeDiscount, decimal discountPct)
    {
        var pct = Math.Clamp(discountPct, 0m, 100m);
        return valueBeforeDiscount * (1m - pct / 100m);
    }

 /// <summary>Discount (if any) then round once.</summary>
    public static (decimal BeforeRounded, decimal Final, bool Applied) FinalOpinionWithOptionalDiscount(
        decimal weightedValue,
        int decimals,
        string? basisOfValueKey,
        string? valuePremiseKey,
        decimal discountPct)
    {
        var apply = ShouldApplyLiquidationDiscount(basisOfValueKey, valuePremiseKey, discountPct);
        var after = apply
            ? ApplyLiquidationDiscount(weightedValue, discountPct)
            : weightedValue;
        return (
            RoundFinal(weightedValue, decimals),
            RoundFinal(after, decimals),
            apply);
    }

 /// <summary>
 /// مواصفة النموذج التفاعلي: الافتراضي أسلوب السوق ١٠٠٪ والتكلفة ٠٪ (apW = {market:100, cost:0})؛
 /// وعند غياب مؤشر السوق يذهب الوزن كاملاً للتكلفة.
 /// </summary>
    public static IReadOnlyList<(string kind, decimal weightPct)> SuggestWeights(
        decimal marketValue,
        decimal costValue)
    {
        var marketOk = marketValue > 0m;
        var costOk = costValue > 0m;
        if (marketOk)
            return [(ValuationApproachKinds.Market, 100m), (ValuationApproachKinds.Cost, 0m)];
        if (costOk)
            return [(ValuationApproachKinds.Market, 0m), (ValuationApproachKinds.Cost, 100m)];
        return [(ValuationApproachKinds.Market, 0m), (ValuationApproachKinds.Cost, 0m)];
    }

    public static bool RequiresWeightRationale(decimal weightPct, bool included) =>
        included && weightPct != 0m;

 /// <summary>n≥2 when two (or more) approaches are selected/enabled for reconciliation.</summary>
    public static bool MeetsMultiMethodGate(int enabledApproachCount) =>
        enabledApproachCount >= 2;

    public static bool MeetsMultiMethodGate(
        IEnumerable<(decimal value, decimal weightPct, bool included)> methods) =>
        MeetsMultiMethodGate(methods.Count(m => m.included));
}
