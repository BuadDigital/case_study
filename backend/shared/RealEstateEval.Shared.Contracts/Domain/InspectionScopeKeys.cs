namespace RealEstateEval.Domain;

/// <summary>نطاق المعاينة (القرار 24) — تُستكمل حقوله مع ميزة حدود المعاينة.</summary>
public static class InspectionScopeKeys
{
    public const string Full = "full";
    public const string ExternalOnly = "external";
    public const string Desktop = "desktop";

    public static bool IsKnown(string? value) =>
        (value ?? "").Trim().ToLowerInvariant() is Full or ExternalOnly or Desktop;

    public static string LabelAr(string? value) => (value ?? "").Trim().ToLowerInvariant() switch
    {
        ExternalOnly => "خارجية فقط",
        Desktop => "مكتبية عن بُعد",
        Full => "كاملة (داخل وخارج)",
        _ => "",
    };
}
