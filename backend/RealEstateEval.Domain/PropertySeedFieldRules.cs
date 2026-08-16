namespace RealEstateEval.Domain;

/// <summary>Boundary type LOV — street · plot · passage · rail.</summary>
public static class PropertyBoundaryTypes
{
    public const string Street = "street";
    public const string Plot = "plot";
    public const string Passage = "passage";
    public const string Rail = "rail";

    public static readonly string[] All = [Street, Plot, Passage, Rail];

    public static bool IsKnown(string? value) =>
        string.IsNullOrWhiteSpace(value)
        || All.Contains(value.Trim(), StringComparer.OrdinalIgnoreCase);

    public static string LabelAr(string? value) => (value?.Trim().ToLowerInvariant()) switch
    {
        Street => "شارع",
        Plot => "قطعة",
        Passage => "ممر",
        Rail => "سكة",
        _ => value?.Trim() ?? "",
    };

 /// <summary>Computed street count for adjustments — اعتراض فقط when derived.</summary>
    public static int CountStreets(params string?[] types) =>
        types.Count(t => string.Equals(t?.Trim(), Street, StringComparison.OrdinalIgnoreCase));
}

/// <summary>Building finishing level — one of four standard texts.</summary>
public static class PropertyFinishingTypes
{
    public const string Luxury = "luxury";
    public const string Medium = "medium";
    public const string Ordinary = "ordinary";
    public const string None = "none";

    public static readonly string[] All = [Luxury, Medium, Ordinary, None];

    public static bool IsKnown(string? value) =>
        string.IsNullOrWhiteSpace(value)
        || All.Contains(value.Trim(), StringComparer.OrdinalIgnoreCase);

    public static string LabelAr(string? value) => (value?.Trim().ToLowerInvariant()) switch
    {
        Luxury => "فاخر",
        Medium => "متوسط",
        Ordinary => "عادي",
        None => "بدون تشطيب",
        _ => value?.Trim() ?? "",
    };
}

/// <summary>Structural system type — not condition (خرساني / معدني / …).</summary>
public static class PropertyFinishingStructures
{
    public const string Concrete = "concrete";
    public const string Metal = "metal";
    public const string Mixed = "mixed";
    public const string Other = "other";

    public static readonly string[] All = [Concrete, Metal, Mixed, Other];

    public static bool IsKnown(string? value) =>
        string.IsNullOrWhiteSpace(value)
        || All.Contains(value.Trim(), StringComparer.OrdinalIgnoreCase);

    public static string LabelAr(string? value) => (value?.Trim().ToLowerInvariant()) switch
    {
        Concrete => "خرساني",
        Metal => "معدني",
        Mixed => "مختلط",
        Other => "أخرى",
        _ => value?.Trim() ?? "",
    };
}
