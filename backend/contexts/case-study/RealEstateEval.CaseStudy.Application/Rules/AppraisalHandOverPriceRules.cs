using System.Globalization;

namespace RealEstateEval.CaseStudy.Application.Rules;

/// <summary>
/// The appraiser's handed-over «سعر التقييم» is the reconciliation's final value — the same figure the
/// report prints. Any other figure (a typed or stale draft price: r8b handed over 9,830,000 while the
/// final was 9,220,000) is refused with both numbers named, in Latin digits.
/// </summary>
public static class AppraisalHandOverPriceRules
{
    public const string ErrorKey = "evaluatorPrice";

    /// <summary>Rounding slack — the final is rounded once; the client sends it as it is.</summary>
    public const decimal ToleranceSar = 0.5m;

    public const string UnverifiedAr =
        "تعذّر التحقق من مطابقة سعر التقييم للقيمة النهائية في الترجيح — أعد المحاولة بعد قليل";

    /// <summary>
    /// Null when the price matches the final (±0.5), or there is no final to compare yet (no
    /// reconciliation, or a final of zero — the final-opinion gate refuses that on its own).
    /// </summary>
    public static Dictionary<string, string>? MismatchError(decimal? handedOverPrice, decimal? finalValue)
    {
        if (finalValue is not { } final || final <= 0m || handedOverPrice is not { } price)
            return null;
        if (Math.Abs(price - final) <= ToleranceSar)
            return null;
        return new Dictionary<string, string>
        {
            [ErrorKey] =
                $"سعر التقييم المُرسَل ({Format(price)} ريال) لا يطابق القيمة النهائية في الترجيح ({Format(final)} ريال) — "
                + "أعد تحميل الصفحة ثم أعد الإرسال ليُعتمد سعر التقييم من رأي القيمة النهائي",
        };
    }

    /// <summary>
    /// Round 2: a price accepted within the ±0.5 slack is stored as the server's final value — the
    /// typed 970000.4 becomes 970000 — so the hand-over and the report carry one figure. Any other
    /// case (no final, a mismatch the gate refuses, a payload without a price) is returned unchanged.
    /// </summary>
    public static string WithFinalPrice(string payloadJson, decimal? handedOverPrice, decimal? finalValue)
    {
        if (finalValue is not { } final || final <= 0m || handedOverPrice is not { } price
            || Math.Abs(price - final) > ToleranceSar)
            return payloadJson;
        try
        {
            if (System.Text.Json.Nodes.JsonNode.Parse(payloadJson) is not System.Text.Json.Nodes.JsonObject root)
                return payloadJson;
            root["evaluatorPrice"] = final.ToString("0.##", CultureInfo.InvariantCulture);
            return root.ToJsonString();
        }
        catch (System.Text.Json.JsonException)
        {
            return payloadJson;
        }
    }

    private static string Format(decimal value) =>
        value.ToString("#,0.##", CultureInfo.InvariantCulture);
}
