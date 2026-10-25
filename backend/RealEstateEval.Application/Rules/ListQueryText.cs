namespace RealEstateEval.Application.Rules;

/// <summary>
/// The wire-value handling every list endpoint's allow-list shares (see
/// docs/architecture/pagination-contract.md): keys and directions compare trimmed and
/// lower-case, blank filters mean "no filter", and in-memory search is a case-insensitive
/// substring. Each <c>*ListQueryRules</c> keeps its own keys and defaults. No EF, no I/O.
/// </summary>
public static class ListQueryText
{
    public const string DirAscending = "asc";
    public const string DirDescending = "desc";

 /// <summary>Trimmed, lower-case form a sort key or direction is matched in; "" for null.</summary>
    public static string Normalize(string? value) => value?.Trim().ToLowerInvariant() ?? "";

 /// <summary><c>asc</c> / <c>desc</c> in any case; anything else is the endpoint's default.</summary>
    public static bool ResolveDescending(string? dir, bool defaultDescending) =>
        Normalize(dir) switch
        {
            DirAscending => false,
            DirDescending => true,
            _ => defaultDescending,
        };

    public static string? NormalizeExact(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    public static string? NormalizeSearch(string? q) =>
        string.IsNullOrWhiteSpace(q) ? null : q.Trim();

    public static bool Contains(string? haystack, string needle) =>
        !string.IsNullOrEmpty(haystack)
        && haystack.Contains(needle, StringComparison.OrdinalIgnoreCase);

    public static IOrderedEnumerable<T> Order<T, TKey>(
        IEnumerable<T> rows,
        Func<T, TKey> key,
        bool descending,
        IComparer<TKey>? comparer = null) =>
        descending ? rows.OrderByDescending(key, comparer) : rows.OrderBy(key, comparer);
}
