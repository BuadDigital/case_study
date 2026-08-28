using System.Text.Json;
using RealEstateEval.Domain;

namespace RealEstateEval.CaseStudy.Domain;

/// <summary>One deed owner from the structured transcription (الملاك وحصصهم).</summary>
public sealed record DeedOwner(string Name, decimal? SharePct);

/// <summary>نوع الملكية values — مطلقة / مرهون / استثمار / مشاع.</summary>
public static class OwnershipTypes
{
    public const string Absolute = "absolute";
    public const string Mortgaged = "mortgaged";
    public const string Investment = "investment";
    public const string Shared = "shared";

    public static bool IsKnown(string? value) =>
        (value ?? "").Trim().ToLowerInvariant() is Absolute or Mortgaged or Investment or Shared;

    public static string LabelAr(string? value) => (value ?? "").Trim().ToLowerInvariant() switch
    {
        Absolute => "ملكية مطلقة",
        Mortgaged => "مرهون",
        Investment => "استثمار",
        Shared => "مشاع",
        _ => "",
    };
}

/// <summary>
/// نوع الملكية derived from the structured deed transcription
/// (editable-derived: the engine suggests, the valuer approves or overrides).
/// Investment never appears on the deed, so it is manual-only.
/// </summary>
public static class OwnershipTypeRules
{
    private static readonly JsonSerializerOptions JsonOptions = JsonDefaults.Web;

 /// <summary>
 /// Derivation order per the decision: قيد رهن ⟵ مرهون · ملاك بحصص ⟵ مشاع ·
 /// مالك واحد بلا قيود ⟵ مطلقة مبدئيًا.
 /// </summary>
    public static string Suggest(
        IReadOnlyList<DeedOwner> owners,
        string? restrictionTypeCsv)
    {
        var restrictions = (restrictionTypeCsv ?? "")
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (restrictions.Contains("mortgaged", StringComparer.OrdinalIgnoreCase))
            return OwnershipTypes.Mortgaged;

        if (owners.Count > 1 || owners.Any(o => o.SharePct is > 0m and < 100m))
            return OwnershipTypes.Shared;

        return OwnershipTypes.Absolute;
    }

 /// <summary>Effective value — manual override wins; otherwise the suggestion.</summary>
    public static string Effective(
        bool isManual,
        string? manualValue,
        IReadOnlyList<DeedOwner> owners,
        string? restrictionTypeCsv)
    {
        if (isManual && OwnershipTypes.IsKnown(manualValue))
            return (manualValue ?? "").Trim().ToLowerInvariant();
        return Suggest(owners, restrictionTypeCsv);
    }

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
            .Select(o => new DeedOwner(o.Name.Trim(), o.SharePct))
            .ToList();
        return cleaned.Count == 0 ? null : JsonSerializer.Serialize(cleaned, JsonOptions);
    }

 /// <summary>Validation: names required, shares in (0,100], sum ≤ 100 (tolerance for thirds).</summary>
    public static string? ValidateOwners(IReadOnlyList<DeedOwner> owners)
    {
        foreach (var o in owners)
        {
            if (string.IsNullOrWhiteSpace(o.Name))
                return "اسم المالك مطلوب لكل سطر";
            if (o.SharePct is <= 0m or > 100m)
                return "حصة المالك يجب أن تكون أكبر من 0 وحتى 100";
        }

        var declared = owners.Where(o => o.SharePct is not null).Sum(o => o.SharePct!.Value);
        if (declared > 100.01m)
            return "مجموع الحصص يتجاوز 100٪";
        return null;
    }
}
