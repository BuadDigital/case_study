using System.Text;

namespace RealEstateEval.Infrastructure.Services;

/// <summary>
/// Splits batch lookup ids so GET query strings stay under Kestrel/nginx's 8 KB request-line cap.
/// A GUID is 36 characters; URI-escaped commas add more. 150 ids is about 6 KB.
/// </summary>
public static class QueryIdBatch
{
    public const int MaxPerGet = 150;
    public const int MaxRequestLineBytes = 8192;

    public static IReadOnlyList<IReadOnlyList<Guid>> OfGuids(IEnumerable<Guid> ids)
    {
        var distinct = ids.Distinct().ToList();
        return Chunk(distinct);
    }

    public static IReadOnlyList<IReadOnlyList<string>> OfStrings(
        IEnumerable<string?> values,
        StringComparer? comparer = null)
    {
        comparer ??= StringComparer.Ordinal;
        var distinct = values
            .Select(value => value?.Trim() ?? "")
            .Where(value => value.Length > 0)
            .Distinct(comparer)
            .ToList();
        return Chunk(distinct);
    }

    public static string JoinEscaped(IReadOnlyList<Guid> ids) =>
        Uri.EscapeDataString(string.Join(",", ids.Select(id => id.ToString("D"))));

    public static string JoinEscaped(IReadOnlyList<string> values) =>
        Uri.EscapeDataString(string.Join(",", values));

    public static int Utf8ByteCount(string value) => Encoding.UTF8.GetByteCount(value);

    private static IReadOnlyList<IReadOnlyList<T>> Chunk<T>(List<T> items)
    {
        if (items.Count == 0)
            return [];

        var chunks = new List<IReadOnlyList<T>>(
            (items.Count + MaxPerGet - 1) / MaxPerGet);
        for (var i = 0; i < items.Count; i += MaxPerGet)
            chunks.Add(items.GetRange(i, Math.Min(MaxPerGet, items.Count - i)));
        return chunks;
    }
}
