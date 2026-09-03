using System.Text.Json;
using RealEstateEval.Domain;

namespace RealEstateEval.CaseStudy.Domain;

/// <summary>Unseen units — counter + reason for each condition (Decision 24).</summary>
public sealed record UninspectedUnitEntry(int Count, string Reason);

/// <summary>
/// Inspection Limitations = Limitations of Inspector (Decision 24 + Q-7): structured input no free text —
/// Inspection Scope + unseen units + reason for the restriction, and the system installs the reservation text
/// And puts it under Special Assumptions. Remote Desktop Blocker even Appraiser certified.
/// Stored on <see cref="WorkOrderProperty"/> (construction question style).
/// </summary>
public static class InspectionLimitsRules
{
    private static readonly JsonSerializerOptions JsonOptions = JsonDefaults.CamelCaseInsensitive;

    public static Dictionary<string, string> Validate(
        string? scopeKey,
        string? restrictionReason,
        IReadOnlyList<UninspectedUnitEntry> uninspectedUnits)
    {
        var errors = new Dictionary<string, string>();
        var scope = (scopeKey ?? "").Trim().ToLowerInvariant();

        if (scope.Length == 0)
            errors["inspectionScopeKey"] = "نطاق المعاينة إلزامي (القرار 24)";
        else if (!InspectionScopeKeys.IsKnown(scope))
            errors["inspectionScopeKey"] = "نطاق المعاينة غير معروف";

 // Restriction reason is mandatory when range ≠ complete or there are unsampled units (requiredWhen).
        var limited = InspectionScopeKeys.IsKnown(scope)
            && !string.Equals(scope, InspectionScopeKeys.Full, StringComparison.Ordinal);
        if ((limited || uninspectedUnits.Count > 0)
            && string.IsNullOrWhiteSpace(restrictionReason))
        {
            errors["inspectionRestrictionReason"] =
                "سبب تقييد المعاينة إلزامي عند نطاق غير كامل أو وجود وحدات غير معاينة";
        }

        for (var i = 0; i < uninspectedUnits.Count; i++)
        {
            var u = uninspectedUnits[i];
            if (u.Count <= 0)
                errors[$"uninspectedUnits[{i}].count"] = "عدد الوحدات يجب أن يكون أكبر من صفر";
            if (string.IsNullOrWhiteSpace(u.Reason))
                errors[$"uninspectedUnits[{i}].reason"] = "سبب عدم المعاينة إلزامي لكل حالة";
        }

        return errors;
    }

    public static int TotalUninspectedUnits(IEnumerable<UninspectedUnitEntry> units) =>
        units.Sum(u => Math.Max(0, u.Count));

 /// <summary>
 /// Composite output (Decision 24): Reservation text placed under Special Assumptions —
 /// Dynamic as output, structured as input. Blank on complete inspection with no units excluded.
 /// </summary>
    public static string ComposeReservationTextAr(
        string? scopeKey,
        string? restrictionReason,
        IReadOnlyList<UninspectedUnitEntry> uninspectedUnits)
    {
        var scope = (scopeKey ?? "").Trim().ToLowerInvariant();
        var parts = new List<string>();

        if (scope == InspectionScopeKeys.ExternalOnly)
            parts.Add("اقتصرت المعاينة على الفحص الخارجي للعقار دون الدخول إليه");
        else if (scope == InspectionScopeKeys.Desktop)
            parts.Add("أُجريت المعاينة مكتبياً عن بُعد بالاعتماد على الخرائط وصور الأقمار الصناعية دون زيارة الموقع");

        var total = TotalUninspectedUnits(uninspectedUnits);
        if (total > 0)
        {
            var reasons = uninspectedUnits
                .Where(u => u.Count > 0 && !string.IsNullOrWhiteSpace(u.Reason))
                .Select(u => $"{u.Count} ({u.Reason.Trim()})");
            parts.Add($"لم تتسنَّ معاينة {total} وحدة: {string.Join("، ", reasons)}");
        }

        if (parts.Count == 0) return "";

        var text = "قيود المعاينة: " + string.Join("؛ و", parts) + ".";
        if (!string.IsNullOrWhiteSpace(restrictionReason))
            text += $" السبب: {restrictionReason.Trim()}.";
        text += " وقد راعى المقيّم هذه القيود في افتراضاته، ويُقرأ رأي القيمة في ضوئها.";
        return text;
    }

    public static string? SerializeUnits(IReadOnlyList<UninspectedUnitEntry> units) =>
        units.Count == 0 ? null : JsonSerializer.Serialize(units, JsonOptions);

    public static IReadOnlyList<UninspectedUnitEntry> ParseUnits(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return [];
        try
        {
            return JsonSerializer.Deserialize<List<UninspectedUnitEntry>>(json, JsonOptions) ?? [];
        }
        catch (JsonException)
        {
            return [];
        }
    }
}
