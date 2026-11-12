using System.Text.Json;

namespace RealEstateEval.CaseStudy.Application.Rules;

/// <summary>
/// The photos the case staff add to a sent field inspection (Omar 2026-11-12): free photos of the
/// payload marked <c>uploadedBy: "specialist"</c>. Pure — reads two payloads and says what changed.
/// </summary>
public static class StaffAddedPhotoRules
{
    public const string AddedTitleAr = "إضافة صور من الأخصائي";
    public const string RemovedTitleAr = "حذف صور أضافها الأخصائي";

    /// <summary>
    /// How many staff photos a save added and how many it removed.
    /// How it works: compares the ids of the staff's free photos before and after the save.
    /// Edge cases: a payload that is not JSON, or has no free photos, holds none; the inspector's own
    /// photos never count, so a save that only touches his photos reports (0, 0).
    /// </summary>
    public static (int Added, int Removed) Change(string? payloadBefore, string? payloadAfter)
    {
        var before = StaffPhotoIds(payloadBefore);
        var after = StaffPhotoIds(payloadAfter);
        return (after.Count(id => !before.Contains(id)), before.Count(id => !after.Contains(id)));
    }

    /// <summary>«3 صور — أسامة الصالحي»: the count in Arabic, then who (left out when unknown).</summary>
    public static string TimelineDetail(int count, string? actorName)
    {
        var name = actorName?.Trim();
        return string.IsNullOrEmpty(name) ? CountAr(count) : $"{CountAr(count)} — {name}";
    }

    /// <summary>«صورة واحدة» · «صورتان» · «3 صور» … «10 صور» · «11 صورة».</summary>
    public static string CountAr(int count) => count switch
    {
        1 => "صورة واحدة",
        2 => "صورتان",
        >= 3 and <= 10 => $"{count} صور",
        _ => $"{count} صورة",
    };

    private static HashSet<long> StaffPhotoIds(string? payloadJson)
    {
        var ids = new HashSet<long>();
        if (string.IsNullOrWhiteSpace(payloadJson)) return ids;
        try
        {
            using var doc = JsonDocument.Parse(payloadJson);
            if (doc.RootElement.ValueKind != JsonValueKind.Object
                || !doc.RootElement.TryGetProperty("freePhotos", out var photos)
                || photos.ValueKind != JsonValueKind.Array)
            {
                return ids;
            }

            foreach (var photo in photos.EnumerateArray())
            {
                if (photo.ValueKind != JsonValueKind.Object) continue;
                if (!photo.TryGetProperty("uploadedBy", out var by)
                    || by.ValueKind != JsonValueKind.String
                    || !string.Equals(by.GetString(), "specialist", StringComparison.Ordinal))
                {
                    continue;
                }

                if (photo.TryGetProperty("id", out var id)
                    && id.ValueKind == JsonValueKind.Number
                    && id.TryGetInt64(out var value))
                {
                    ids.Add(value);
                }
            }
        }
        catch (JsonException)
        {
            // Not a payload we can read: no staff photos in it.
        }

        return ids;
    }
}
