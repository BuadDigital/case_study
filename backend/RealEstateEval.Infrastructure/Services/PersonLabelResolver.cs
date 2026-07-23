using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Rules;
using RealEstateEval.Infrastructure.Data;

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

    public static async Task<string> ResolveAsync(
        ApplicationDbContext db,
        string? raw,
        CancellationToken cancellationToken = default)
    {
        var normalized = NormalizeSystemLabel(raw);
        if (normalized.Length == 0) return "";
        if (!LooksLikeUserId(normalized)) return normalized;

        var name = await db.Users.AsNoTracking()
            .Where(u => u.Id == normalized)
            .Select(u => u.DisplayName)
            .FirstOrDefaultAsync(cancellationToken);
        return string.IsNullOrWhiteSpace(name) ? normalized : name.Trim();
    }

    public static async Task<IReadOnlyDictionary<string, string>> ResolveManyAsync(
        ApplicationDbContext db,
        IEnumerable<string?> raws,
        CancellationToken cancellationToken = default)
    {
        var ids = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var raw in raws)
        {
            var value = raw?.Trim() ?? "";
            if (LooksLikeUserId(value)) ids.Add(value);
        }

        if (ids.Count == 0)
            return new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        var names = await db.Users.AsNoTracking()
            .Where(u => ids.Contains(u.Id))
            .Select(u => new { u.Id, u.DisplayName })
            .ToListAsync(cancellationToken);

        var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var row in names)
        {
            if (!string.IsNullOrWhiteSpace(row.DisplayName))
                map[row.Id] = row.DisplayName.Trim();
        }

        return map;
    }

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
}
