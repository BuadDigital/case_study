using System.Text.Json;

namespace RealEstateEval.CaseStudy.Application.Rules;

/// <summary>
/// One column holds a property's uploaded file names — a JSON array today, a bare filename in
/// legacy rows. Reading and writing that column is the same rule for every producer.
/// </summary>
public static class PropertyFileNameList
{
    /// <summary>Accepts a legacy plain filename or a JSON array string in the same column.</summary>
    public static List<string> Parse(string? stored)
    {
        if (string.IsNullOrWhiteSpace(stored)) return [];
        var trimmed = stored.Trim();
        if (trimmed.StartsWith('['))
        {
            try
            {
                return (JsonSerializer.Deserialize<List<string>>(trimmed) ?? [])
                    .Select(s => s.Trim())
                    .Where(s => s.Length > 0)
                    .ToList();
            }
            catch
            {
                return [];
            }
        }

        return [trimmed];
    }

    /// <summary>Empty lists are stored as null so "no file" stays one value.</summary>
    public static string? Serialize(IEnumerable<string>? names)
    {
        var list = (names ?? [])
            .Select(s => s.Trim())
            .Where(s => s.Length > 0)
            .ToList();
        return list.Count == 0 ? null : JsonSerializer.Serialize(list);
    }

    public static bool HasAny(string? stored) => Parse(stored).Count > 0;
}
