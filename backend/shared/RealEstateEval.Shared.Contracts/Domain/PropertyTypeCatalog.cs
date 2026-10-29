namespace RealEstateEval.Domain;

/// <summary>
/// Every property type of the system under its classification — the bourse picker's list and, since
/// 2026-10-29, the inspector's «الأصل محل التقييم» (he corrects the bourse type from it on site).
/// TS twin: PROPERTY_TYPES_BY_CLASSIFICATION / ALL_PROPERTY_TYPES in
/// packages/app-shared/src/app-data/inspector-workspace-data.ts — change both.
/// </summary>
public static class PropertyTypeCatalog
{
    public const string Land = "أرض";
    public const string SingleBuilding = "مبنى مفرد";
    public const string Complex = "مجمع";
    public const string UnitInBuilding = "وحدة داخل مبنى";
    public const string PublicFacility = "مرفق عام";

    private static readonly (string Classification, string[] Types)[] ByClassification =
    [
        (Land, ["أرض سكنية", "أرض تجارية", "أرض صناعية", "أرض زراعية", "أرض مختلطة"]),
        (SingleBuilding,
        [
            "فيلا", "عمارة", "منزل", "بيت شعبي", "قصر", "برج", "مستودع", "مصنع", "ورشة", "فندق",
            "محطة بنزين", "مزرعة", "شاليه", "منتجع", "عيادة", "مواقف سيارات",
        ]),
        (Complex,
        [
            "مجمع سكني", "مجمع تجاري", "مجمع فلل", "مجمع تعليمي", "مجمع حكومي", "مجمع عيادات",
            "مجمع ترفيهي", "مدينة رياضية", "مجمع متعدد الاستخدامات",
        ]),
        (UnitInBuilding, ["شقة سكنية", "محل تجاري", "معرض", "مكتب", "دور"]),
        (PublicFacility,
        [
            "مستشفى", "مركز صحي", "مركز شرطة", "استراحة", "قاعة أفراح", "سوق تجاري", "مسجد", "مقبرة",
            "محطة تحلية مياه", "محطة كهرباء", "برج اتصالات", "مطار",
        ]),
    ];

    /// <summary>
    /// The six short values the inspector's list held before 2026-10-29 — still read on old payloads.
    /// </summary>
    private static readonly Dictionary<string, string> LegacyInspectorValues = new(StringComparer.Ordinal)
    {
        ["فيلا"] = SingleBuilding,
        ["أرض"] = Land,
        ["شقة"] = UnitInBuilding,
        ["عمارة"] = SingleBuilding,
        ["محل تجاري"] = UnitInBuilding,
        ["مستودع"] = SingleBuilding,
    };

    private static readonly Dictionary<string, string> ClassificationByType = ByClassification
        .SelectMany(g => g.Types.Select(t => (Type: t, g.Classification)))
        .ToDictionary(x => x.Type, x => x.Classification, StringComparer.Ordinal);

    /// <summary>The catalogue types in classification order (47).</summary>
    public static IReadOnlyList<string> All { get; } =
        ByClassification.SelectMany(g => g.Types).ToArray();

    /// <summary>A type the inspector may submit: the catalogue, or a legacy short value.</summary>
    public static bool IsInspectorValue(string? type)
    {
        var t = (type ?? "").Trim();
        return ClassificationByType.ContainsKey(t) || LegacyInspectorValues.ContainsKey(t);
    }

    /// <summary>The classification of a catalogue (or legacy inspector) type; null for anything else.</summary>
    public static string? ClassificationOf(string? type)
    {
        var t = (type ?? "").Trim();
        if (ClassificationByType.TryGetValue(t, out var classification)) return classification;
        return LegacyInspectorValues.TryGetValue(t, out var legacy) ? legacy : null;
    }
}
