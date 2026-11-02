using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;

namespace RealEstateEval.Platform.Application.Rules;

/// <summary>
/// The «استخدام العقار» list works like unregistered cities: a name the inspector meets on site is
/// usable at once, repeats count on one row, and a reviewer approves or corrects it later.
/// </summary>
public static class PropertyUsageListRules
{
    public const string ActionApprove = "approve";
    public const string ActionRename = "rename";

    /// <summary>
    /// Counts <paramref name="nameAr"/> on the list.
    /// How it works: names compare through the location normalizer, so a changed hamza or ta marbuta
    /// lands on the same row and bumps its count. A new name joins at the end as pending.
    /// Edge cases: an empty name, a non-Arabic one, or an old classification value changes nothing and
    /// returns null: the inspection is already saved, and the list must not collect «مبنى مفرد».
    /// </summary>
    public static List<ValuationListItemDto>? Record(
        IReadOnlyList<ValuationListItemDto> rows,
        string? nameAr,
        Func<string> newKey)
    {
        var raw = (nameAr ?? "").Trim();
        if (!LocationNameNormalizer.LooksLikeArabicName(raw) || PropertyTypeCatalog.IsClassification(raw))
            return null;

        var next = rows.ToList();
        var index = IndexOfName(next, raw);
        if (index >= 0)
        {
            next[index] = Copy(next[index], usage: next[index].Usage + 1);
            return next;
        }

        var key = newKey();
        next.Add(new ValuationListItemDto
        {
            Id = $"{ValuationListIds.PropertyUsages}-{key}",
            Key = key,
            Name = raw,
            DefaultName = raw,
            RawInput = raw,
            Status = ValuationListItemStatuses.Pending,
            Usage = 1,
            SortOrder = next.Count == 0 ? 1 : next.Max(r => r.SortOrder) + 1,
        });
        return next;
    }

    /// <summary>
    /// Approves the row, or corrects and approves it.
    /// How it works: «rename» replaces the name and keeps the first spelling in RawInput. The row need
    /// not be pending, because the admin may change an approved name later.
    /// Edge cases: a corrected name another row already holds is refused, so the list never shows one
    /// usage twice. Inspections already saved keep the name they carry, as a corrected city does.
    /// </summary>
    /// <exception cref="InvalidOperationException">With the reviewer-facing Arabic message.</exception>
    public static List<ValuationListItemDto> Review(
        IReadOnlyList<ValuationListItemDto> rows,
        string key,
        string? action,
        string? nameAr)
    {
        var next = rows.ToList();
        var index = next.FindIndex(r => string.Equals(r.Key, (key ?? "").Trim(), StringComparison.OrdinalIgnoreCase));
        if (index < 0)
            throw new InvalidOperationException("الاستخدام غير موجود في القائمة.");

        var normalized = LocationCatalogRules.NormalizeAction(action);
        if (normalized is not (ActionApprove or ActionRename))
            throw new InvalidOperationException("الإجراء غير معروف.");

        var row = next[index];
        var name = normalized == ActionRename ? LocationCatalogRules.ResolveReviewName(nameAr) : null;
        if (name is not null && IndexOfName(next, name, except: index) >= 0)
            throw new InvalidOperationException("هذا الاستخدام موجود في القائمة.");

        next[index] = Copy(row, name: name ?? row.Name, status: ValuationListItemStatuses.Approved);
        return next;
    }

    private static int IndexOfName(List<ValuationListItemDto> rows, string name, int except = -1)
    {
        var search = LocationNameNormalizer.Normalize(name);
        for (var i = 0; i < rows.Count; i++)
        {
            if (i != except && LocationNameNormalizer.Normalize(rows[i].Name) == search) return i;
        }

        return -1;
    }

    private static ValuationListItemDto Copy(
        ValuationListItemDto row,
        string? name = null,
        string? status = null,
        int? usage = null) =>
        new()
        {
            Id = row.Id,
            Key = row.Key,
            Name = name ?? row.Name,
            Cells = row.Cells,
            IsEnabled = row.IsEnabled,
            DefaultName = row.DefaultName,
            Usage = usage ?? row.Usage,
            SortOrder = row.SortOrder,
            IsSystemDefault = row.IsSystemDefault,
            IsRequired = row.IsRequired,
            PropertyTypeKeys = row.PropertyTypeKeys,
            Status = status ?? row.Status,
            RawInput = row.RawInput,
        };
}
