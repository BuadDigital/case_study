using System.Text.Json;
using RealEstateEval.Domain;

namespace RealEstateEval.CaseStudy.Domain;

/// <summary>One deed owner from the structured transcription (the owners list).</summary>
public sealed record DeedOwner(string Name);

/// <summary>Ownership Type values — «ملكية تامة» (absolute) or «مشاع» (shared).</summary>
public static class OwnershipTypes
{
    public const string Absolute = "absolute";
    public const string Shared = "shared";

    public static bool IsKnown(string? value) =>
        (value ?? "").Trim().ToLowerInvariant() is Absolute or Shared;

    public static string LabelAr(string? value) => (value ?? "").Trim().ToLowerInvariant() switch
    {
        // One wording everywhere (round 2): «ملكية تامة» / «حق منفعة» / «أرض مستأجرة».
        Absolute => "ملكية تامة",
        Shared => "مشاع",
        _ => "",
    };
}

/// <summary>
/// The ownership type and the stored owners list.
/// </summary>
/// <remarks>
/// How it works: the type is the staff's «مشاع» tick on the property (<see cref="WorkOrderProperty.IsSharedOwnership"/>)
/// — ticked → shared, else absolute. A mortgage is a restriction on the deed (RestrictionType), not an
/// ownership type; shares are not modelled.
/// Edge cases and what was fixed: until 2026-11-10 the type was derived from the owners count (several
/// owners → shared); Omar ruled the staff decide it, since a deed with several owners is not always
/// shared and they know which. Migration <c>SharedOwnershipFlag</c> ticked the deeds the old rule called
/// shared, so nothing changed for them.
/// </remarks>
public static class OwnershipTypeRules
{
    private static readonly JsonSerializerOptions JsonOptions = JsonDefaults.Web;

    /// <summary>The «مشاع» tick → shared; otherwise absolute.</summary>
    public static string FromSharedFlag(bool isShared) =>
        isShared ? OwnershipTypes.Shared : OwnershipTypes.Absolute;

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
