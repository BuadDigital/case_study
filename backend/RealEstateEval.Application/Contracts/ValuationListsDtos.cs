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

    public static readonly string[] TableLists =
    [
        Purposes, ValueBases, Premises, Methods, Comparables, Glossary, IvsStandards, Attachments,
    ];
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
}

public sealed class ValuationListsDto
{
    public string IvsEffectiveDate { get; init; } = "31 يناير 2025";
    public int PhotoPagesLand { get; init; } = 1;
    public int PhotoPagesBuilt { get; init; } = 2;
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
