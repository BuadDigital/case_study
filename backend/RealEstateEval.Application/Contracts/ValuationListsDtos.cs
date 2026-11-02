namespace RealEstateEval.Application.Contracts;

public static class ValuationListIds
{
    public const string Purposes = "purposes";
    public const string ValueBases = "valueBases";
    public const string Premises = "premises";
    public const string Methods = "methods";
    public const string Comparables = "comparables";
    public const string Glossary = "glossary";
    public const string IvsStandards = "ivsStandards";
    public const string Attachments = "attachments";
    public const string Facades = "facades";
    public const string BoundaryTypes = "boundaryTypes";
    public const string PropertyUsages = "propertyUsages";

    public static readonly string[] TableLists =
    [
        Purposes, ValueBases, Premises, Methods, Comparables, Facades, BoundaryTypes, PropertyUsages,
        Glossary, IvsStandards, Attachments,
    ];
}

/// <summary>
/// A list row's review state. Only «استخدام العقار» has pending rows: a name the inspector met on site
/// and the list did not have. Every other row reads as approved.
/// </summary>
public static class ValuationListItemStatuses
{
    public const string Approved = "approved";
    public const string Pending = "pending";

    public static string Normalize(string? value) =>
        string.Equals(value?.Trim(), Pending, StringComparison.OrdinalIgnoreCase) ? Pending : Approved;
}

public sealed class ValuationListItemDto
{
    public required string Id { get; init; }
    public required string Key { get; init; }
    public required string Name { get; init; }
    public IReadOnlyList<string> Cells { get; init; } = [];
    public bool IsEnabled { get; init; } = true;
    public string DefaultName { get; init; } = "";
    public int Usage { get; init; }
    public int SortOrder { get; init; }
    public bool IsSystemDefault { get; init; }
    public bool IsRequired { get; init; }
    public IReadOnlyList<string> PropertyTypeKeys { get; init; } = [];
    /// <summary>approved | pending — see <see cref="ValuationListItemStatuses"/>.</summary>
    public string Status { get; init; } = ValuationListItemStatuses.Approved;
    /// <summary>The name as first typed, kept when the row is corrected.</summary>
    public string? RawInput { get; init; }
}

public sealed class ValuationListsDto
{
    public string IvsEffectiveDate { get; init; } = "31 يناير 2025";
    public int PhotoPagesLand { get; init; } = 4;
    public int PhotoPagesBuilt { get; init; } = 4;
    public Dictionary<string, List<ValuationListItemDto>> Lists { get; init; } = [];
    public DateTime UpdatedAtUtc { get; init; }
}

public sealed class SaveValuationListsRequest
{
    public string? IvsEffectiveDate { get; init; }
    public int? PhotoPagesLand { get; init; }
    public int? PhotoPagesBuilt { get; init; }
    public Dictionary<string, List<ValuationListItemDto>>? Lists { get; init; }
}

/// <summary>A usage name written on an inspection, to count it or queue it for review.</summary>
public sealed class RecordPropertyUsageRequest
{
    public string? NameAr { get; init; }
}

/// <summary>Review of a usage name: «approve», or «rename» with the corrected name.</summary>
public sealed class ReviewPropertyUsageRequest
{
    public string? Action { get; init; }
    public string? NameAr { get; init; }
}
