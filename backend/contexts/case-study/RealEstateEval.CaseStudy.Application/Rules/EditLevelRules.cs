using System.Text.Json;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;

namespace RealEstateEval.CaseStudy.Application.Rules;

/// <summary>
/// «التعديل» level guards (Omar 2026-11-18). The coordinator picks which reports reopen; the server makes sure
/// a change the valuation depends on never leaves under the old valuation report.
/// </summary>
/// <remarks>
/// How it works:
/// <list type="bullet">
/// <item>A value or forced-sale ratio change always reopens the valuation report.</item>
/// <item>A study-only reopening stores the deed's data as it was (<see cref="Snapshot"/>); before the
/// transaction goes back to Enfaz, <see cref="ChangedValuationInputs"/> lists the data the valuation report
/// prints or reads that changed since. Any change refuses the upload until the valuation is reopened too.</item>
/// </list>
/// Edge cases: the comparison is the change log's (<see cref="PropertyFieldChangeRules.Diff"/>): absent, null
/// and "" are equal, so a re-sent unchanged field never refuses. An unreadable snapshot compares as nothing
/// changed (the upload is not blocked by our own bad data).
/// </remarks>
public static class EditLevelRules
{
    public const string ValueChangeNeedsValuationAr =
        "تعديل القيمة أو نسبة التصفية يفتح تقرير التقييم — اختر «تقرير التقييم» أيضًا.";

    public const string ValuationInputsChangedAr =
        "تغيّرت في هذا التعديل بيانات يطبعها تقرير التقييم أو يقرؤها — أعد فتح تقرير التقييم قبل الرفع";

    /// <summary>
    /// The deed's data the valuation report prints or reads: the distribution-locked fields (deed, registry,
    /// boundaries, map link, type, classification), the area and the owner.
    /// </summary>
    public static readonly IReadOnlySet<string> ValuationReadKeys = new HashSet<string>(
        PropertyDistributionLockRules.LockedKeys.Concat(["area", "ownerName"]),
        StringComparer.Ordinal);

    /// <summary>
    /// The changed fields in words, grouped as the report shows them (each boundary's four fields are one
    /// «الحدود»), in a stable order, without repeats.
    /// </summary>
    public static string ChangedLabelsAr(IEnumerable<string> keys) =>
        string.Join("، ", keys.Select(LabelAr).Distinct().OrderBy(x => x, StringComparer.Ordinal));

    private static string LabelAr(string key) => key switch
    {
        "deedNumber" or "deedDate" or "identifierType" => "الصك",
        "realEstateRegNumber" or "realEstateRegDate" => "السجل العقاري",
        "locationMapUrl" => "رابط الموقع",
        "propertyType" or "classification" => "نوع العقار وتصنيفه",
        "area" => "المساحة",
        "ownerName" => "اسم المالك",
        _ => "الحدود",
    };

    /// <summary>The deed's data at the reopening, kept on the reopening row.</summary>
    public static string Snapshot(WorkOrderPropertyDto property) =>
        JsonSerializer.Serialize(property, JsonDefaults.Web);

    /// <summary>The valuation-read fields that changed since the snapshot; empty when none (or unreadable).</summary>
    public static IReadOnlyList<string> ChangedValuationInputs(string? snapshotJson, WorkOrderPropertyDto current)
    {
        if (string.IsNullOrWhiteSpace(snapshotJson)) return [];
        WorkOrderPropertyDto? before;
        try
        {
            before = JsonSerializer.Deserialize<WorkOrderPropertyDto>(snapshotJson, JsonDefaults.Web);
        }
        catch (JsonException)
        {
            return [];
        }
        if (before is null) return [];
        return PropertyFieldChangeRules.Diff(before, current).Keys.Where(ValuationReadKeys.Contains).ToList();
    }
}
