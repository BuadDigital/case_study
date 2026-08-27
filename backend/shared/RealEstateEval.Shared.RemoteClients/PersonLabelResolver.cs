using System.Text.RegularExpressions;
using RealEstateEval.Application.Rules;

namespace RealEstateEval.Infrastructure.Services;

/// <summary>
/// Maps stored actor labels that may be user ids or the English "system" token
/// into Arabic-friendly display names for UI lists.
/// </summary>
public static class PersonLabelResolver
{
    private static readonly Regex GuidLike = new(
        @"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    public static string NormalizeSystemLabel(string? raw)
    {
        var value = raw?.Trim() ?? "";
        if (value.Length == 0) return "";
        if (string.Equals(value, "system", StringComparison.OrdinalIgnoreCase)
            || string.Equals(value, DocumentaryWorkflowRules.SystemRaiserRole, StringComparison.Ordinal))
        {
            return DocumentaryWorkflowRules.SystemRaiserRole;
        }

        return value;
    }

    public static bool LooksLikeUserId(string? raw)
    {
        var value = raw?.Trim() ?? "";
        return value.Length > 0 && GuidLike.IsMatch(value);
    }

    public static bool LooksLikePersonName(string? raw)
    {
        var value = raw?.Trim() ?? "";
        if (value.Length == 0) return false;
        if (LooksLikeUserId(value)) return false;
        if (string.Equals(value, "system", StringComparison.OrdinalIgnoreCase)) return false;
        return true;
    }

    // A8: the EF-backed Resolve/ResolveMany moved into UserLabelLookup (Identity context
    // library) — this class keeps only the pure label helpers used across contexts.

    public static string ApplyResolved(
        string? raw,
        IReadOnlyDictionary<string, string> namesById)
    {
        var normalized = NormalizeSystemLabel(raw);
        if (normalized.Length == 0) return "";
        if (LooksLikeUserId(normalized)
            && namesById.TryGetValue(normalized, out var name)
            && !string.IsNullOrWhiteSpace(name))
        {
            return name;
        }

        return normalized;
    }

 /// <summary>
 /// Prefer a real person name; if the stored label is empty or a user id, look up
 /// <paramref name="userId"/> / the label itself. Never returns a raw GUID when unresolved —
 /// returns empty so UIs can show a friendly fallback.
 /// </summary>
    public static string ResolveDisplayLabel(
        string? storedLabel,
        string? userId,
        IReadOnlyDictionary<string, string> namesById)
    {
        if (LooksLikePersonName(storedLabel))
            return storedLabel!.Trim();

        foreach (var candidate in new[] { storedLabel, userId })
        {
            var resolved = ApplyResolved(candidate, namesById);
            if (LooksLikePersonName(resolved))
                return resolved;
        }

        return "";
    }
}
