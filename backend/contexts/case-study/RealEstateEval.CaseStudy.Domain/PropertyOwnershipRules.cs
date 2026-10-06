using System.Text.Json;
using RealEstateEval.Domain;

namespace RealEstateEval.CaseStudy.Domain;

/// <summary>One deed owner from the structured transcription (the owners list).</summary>
public sealed record DeedOwner(string Name);

/// <summary>Ownership Type values — who owns the property: one owner (absolute) or several (shared).</summary>
public static class OwnershipTypes
{
    public const string Absolute = "absolute";
    public const string Shared = "shared";

    public static bool IsKnown(string? value) =>
        (value ?? "").Trim().ToLowerInvariant() is Absolute or Shared;

    public static string LabelAr(string? value) => (value ?? "").Trim().ToLowerInvariant() switch
    {
        Absolute => "ملكية مطلقة",
        Shared => "مشاع",
        _ => "",
    };
}

/// <summary>
/// Ownership Type is derived from the owners list alone (decision 2026-10-06, supersedes the
/// earlier four-value rule): one owner → absolute, more than one owner → shared. A mortgage is a
/// restriction on the deed (see RestrictionType), not an ownership type; shares are not modelled.
/// </summary>
public static class OwnershipTypeRules
{
    private static readonly JsonSerializerOptions JsonOptions = JsonDefaults.Web;

    /// <summary>More than one named owner → shared; otherwise absolute (no owners yet counts as absolute).</summary>
    public static string FromOwners(IReadOnlyList<DeedOwner> owners) =>
        owners.Count(o => !string.IsNullOrWhiteSpace(o.Name)) > 1
            ? OwnershipTypes.Shared
            : OwnershipTypes.Absolute;

    /// <summary>Reads the stored owners JSON; a legacy <c>sharePct</c> key is ignored.</summary>
    public static IReadOnlyList<DeedOwner> ParseOwners(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return [];
        try
        {
            return JsonSerializer.Deserialize<List<DeedOwner>>(json, JsonOptions) ?? [];
        }
        catch (JsonException)
        {
            return [];
        }
    }

    public static string? SerializeOwners(IReadOnlyList<DeedOwner>? owners)
    {
        var cleaned = (owners ?? [])
            .Where(o => !string.IsNullOrWhiteSpace(o.Name))
            .Select(o => new DeedOwner(o.Name.Trim()))
            .ToList();
        return cleaned.Count == 0 ? null : JsonSerializer.Serialize(cleaned, JsonOptions);
    }
}
