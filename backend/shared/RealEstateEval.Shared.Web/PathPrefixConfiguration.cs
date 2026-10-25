using Microsoft.Extensions.Configuration;

namespace RealEstateEval.Shared.Web;

/// <summary>Request-path prefix lists bound from configuration (rate limiting, security headers).</summary>
internal static class PathPrefixConfiguration
{
 /// <summary>
 /// The configured prefixes, or <paramref name="fallback"/> when none are set. Blank entries are
 /// dropped; each prefix is trimmed, rooted at <c>/</c>, and loses any trailing slash.
 /// </summary>
    public static IReadOnlyList<string> Read(IConfiguration section, string[] fallback)
    {
        var configured = section.Get<string[]>();
        var source = configured is { Length: > 0 } ? configured : fallback;

        var prefixes = new List<string>(source.Length);
        foreach (var entry in source)
        {
            if (string.IsNullOrWhiteSpace(entry))
                continue;

            var normalized = entry.Trim().TrimEnd('/');
            if (!normalized.StartsWith('/'))
                normalized = "/" + normalized;

            prefixes.Add(normalized);
        }

        return prefixes;
    }
}
