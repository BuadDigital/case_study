using RealEstateEval.Valuation.Application.Contracts;

namespace RealEstateEval.Valuation.Application.Rules;

/// <summary>
/// How «مستندات ذات قيمة» print: an approach names its internal method, or the methods its
/// document indicators carry (e.g. أسلوب الدخل — الطريقة المتبقية).
/// </summary>
public static class ValueDocumentReportRules
{
    public const string Unused = "غير مستخدم";

    public static string MethodLabel(
        string approachKey,
        string? internalMethodLabel,
        ValuationReconciliationDto? recon)
    {
        var named = (recon?.Methods ?? [])
            .Where(m => m.ValueDocumentAttachmentId is not null && m.IsIncluded)
            .Where(m => string.Equals(m.DocumentApproachKey, approachKey, StringComparison.OrdinalIgnoreCase))
            .Select(m => (m.DocumentMethodName ?? "").Trim())
            .Where(n => n.Length > 0);
        var all = (internalMethodLabel is null ? [] : new[] { internalMethodLabel }).Concat(named).ToList();
        return all.Count == 0 ? Unused : string.Join(" · ", all);
    }

    public static bool HasIndicator(string approachKey, ValuationReconciliationDto? recon) =>
        (recon?.Methods ?? []).Any(m => m.ValueDocumentAttachmentId is not null
            && m.IsIncluded
            && string.Equals(m.DocumentApproachKey, approachKey, StringComparison.OrdinalIgnoreCase));
}
