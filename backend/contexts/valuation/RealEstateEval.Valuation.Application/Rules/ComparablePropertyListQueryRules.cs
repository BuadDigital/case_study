namespace RealEstateEval.Valuation.Application.Rules;

/// <summary>Sortable columns of the comparable bank, resolved from the wire <c>sort</c> value.</summary>
public enum ComparablePropertyListSortKey
{
 /// <summary>Transaction date — the order the endpoint has always returned.</summary>
    TransactionDate,
    Created,
    Price,
    PricePerSqm,
    Area,
    District,
}

/// <summary>
/// Pure allow-list and sort map for <c>GET /api/comparable-properties</c>. No EF, no I/O — the
/// repository turns these values into expressions.
/// See docs/architecture/pagination-contract.md §4.
/// </summary>
public static class ComparablePropertyListQueryRules
{
    public const string SortTransaction = "transaction";
    public const string SortCreated = "created";
    public const string SortPrice = "price";
    public const string SortPricePerSqm = "pricePerSqm";
    public const string SortArea = "area";
    public const string SortDistrict = "district";

    public const string DirAscending = "asc";
    public const string DirDescending = "desc";

    public const string DefaultSort = SortTransaction;
    public const bool DefaultDescending = true;

    public static IReadOnlyList<string> AllowedSortKeys { get; } =
        [SortTransaction, SortCreated, SortPrice, SortPricePerSqm, SortArea, SortDistrict];

    public static ComparablePropertyListSortKey ResolveSort(string? sort) =>
        Normalize(sort) switch
        {
            "created" => ComparablePropertyListSortKey.Created,
            "price" => ComparablePropertyListSortKey.Price,
            "pricepersqm" => ComparablePropertyListSortKey.PricePerSqm,
            "area" => ComparablePropertyListSortKey.Area,
            "district" => ComparablePropertyListSortKey.District,
            _ => ComparablePropertyListSortKey.TransactionDate,
        };

    public static bool ResolveDescending(string? dir) =>
        Normalize(dir) switch
        {
            DirAscending => false,
            DirDescending => true,
            _ => DefaultDescending,
        };

    public static string? NormalizeSearch(string? q) =>
        string.IsNullOrWhiteSpace(q) ? null : q.Trim();

 /// <summary>
 /// Subject property for the comparison-method §2 display priority. A blank or unparsable value
 /// means "no priority", never an error.
 /// </summary>
    public static Guid? ResolveForPropertyId(string? forPropertyId) =>
        Guid.TryParse(forPropertyId, out var parsed) && parsed != Guid.Empty ? parsed : null;

    private static string Normalize(string? value) => value?.Trim().ToLowerInvariant() ?? "";
}
