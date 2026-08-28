namespace RealEstateEval.Domain;

/// <summary>
/// تطبيع النصوص الاختيارية — كانت الدالة منسوخة بثمانية أسماء عبر خمسة سياقات
/// (NullIfBlank / NullIfEmpty / NormalizeOptionalText / Normalize / Clean).
/// </summary>
public static class Texts
{
    public static string? NullIfBlank(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
