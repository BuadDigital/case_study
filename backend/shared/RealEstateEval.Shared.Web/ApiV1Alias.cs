namespace RealEstateEval.Shared.Web;

/// <summary>
/// Canonical routes are unversioned <c>/api/...</c> (v1). Explicit <c>/v1</c> is a
/// compatibility alias. Breaking changes would use <c>/v2</c>, not Asp.Versioning.
/// </summary>
public static class ApiV1Alias
{
    public static string? ForTemplate(string? template)
    {
        if (string.IsNullOrWhiteSpace(template))
            return null;

        var original = template.Trim();
        var absoluteOverride = original.StartsWith("~/");
        var body = absoluteOverride ? original[2..] : original.TrimStart('/');
        if (body.Length == 0)
            return null;

        var segments = body.Split('/', StringSplitOptions.RemoveEmptyEntries);
        if (segments.Length == 0
            || !segments[0].Equals("api", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        foreach (var segment in segments)
        {
            if (segment.StartsWith('{'))
                continue;
            if (segment.Equals("v1", StringComparison.OrdinalIgnoreCase)
                || segment.Equals("v2", StringComparison.OrdinalIgnoreCase))
            {
                return null;
            }
        }

        var insertAt = segments.Length;
        for (var i = 0; i < segments.Length; i++)
        {
            if (segments[i].StartsWith('{'))
            {
                insertAt = i;
                break;
            }
        }

        var alias = new string[segments.Length + 1];
        Array.Copy(segments, 0, alias, 0, insertAt);
        alias[insertAt] = "v1";
        Array.Copy(segments, insertAt, alias, insertAt + 1, segments.Length - insertAt);

        var joined = string.Join('/', alias);
        return absoluteOverride ? "~/" + joined : joined;
    }
}
