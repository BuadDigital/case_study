using System.Text.Json;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Application.Rules;

/// <summary>Deed text / length the inspector recorded for one side in «الحدود والأطوال».</summary>
public sealed record InspectorDeedBoundary(string? Description, string? LengthM);

/// <summary>
/// Mirrors the inspector's deed boundaries («الحد حسب الصك» / «الطول») onto the property's
/// intake boundary fields once the specialist confirms the package, so the bourse-stage table,
/// the inspector table and the printed §08 all show one set of values. Boundary type
/// (شارع/قطعة…) and facade stay untouched — the inspector table has no type column.
/// </summary>
public static class InspectorBoundarySyncRules
{
    public static readonly string[] Sides = ["north", "south", "east", "west"];

    /// <summary>Sides where the inspector wrote a description or a length; empty entries are skipped.</summary>
    public static IReadOnlyDictionary<string, InspectorDeedBoundary> FromPayload(string? payloadJson)
    {
        var result = new Dictionary<string, InspectorDeedBoundary>(StringComparer.Ordinal);
        if (string.IsNullOrWhiteSpace(payloadJson)) return result;
        try
        {
            using var doc = JsonDocument.Parse(payloadJson);
            if (!doc.RootElement.TryGetProperty("boundaryMatches", out var matches)
                || matches.ValueKind != JsonValueKind.Object)
            {
                return result;
            }

            foreach (var side in Sides)
            {
                if (!matches.TryGetProperty(side, out var match) || match.ValueKind != JsonValueKind.Object)
                    continue;
                var description = ReadString(match, "deedDesc");
                var length = ReadString(match, "deedLength");
                if (description is null && length is null) continue;
                result[side] = new InspectorDeedBoundary(description, length);
            }
        }
        catch (JsonException)
        {
            // A malformed payload never blocks acceptance — the property simply keeps its own values.
        }

        return result;
    }

    /// <summary>Writes each recorded side onto the property; a side the inspector left blank keeps the intake value.</summary>
    public static bool Apply(WorkOrderProperty property, IReadOnlyDictionary<string, InspectorDeedBoundary> sides)
    {
        var changed = false;
        foreach (var (side, deed) in sides)
        {
            switch (side)
            {
                case "north":
                    changed |= Set(deed.Description, v => property.NorthBoundary = v, property.NorthBoundary);
                    changed |= Set(deed.LengthM, v => property.NorthBoundaryLengthM = v, property.NorthBoundaryLengthM);
                    break;
                case "south":
                    changed |= Set(deed.Description, v => property.SouthBoundary = v, property.SouthBoundary);
                    changed |= Set(deed.LengthM, v => property.SouthBoundaryLengthM = v, property.SouthBoundaryLengthM);
                    break;
                case "east":
                    changed |= Set(deed.Description, v => property.EastBoundary = v, property.EastBoundary);
                    changed |= Set(deed.LengthM, v => property.EastBoundaryLengthM = v, property.EastBoundaryLengthM);
                    break;
                case "west":
                    changed |= Set(deed.Description, v => property.WestBoundary = v, property.WestBoundary);
                    changed |= Set(deed.LengthM, v => property.WestBoundaryLengthM = v, property.WestBoundaryLengthM);
                    break;
            }
        }
        return changed;
    }

    private static bool Set(string? value, Action<string> assign, string? current)
    {
        if (value is null || string.Equals(value, current, StringComparison.Ordinal)) return false;
        assign(value);
        return true;
    }

    private static string? ReadString(JsonElement element, string name)
    {
        if (!element.TryGetProperty(name, out var value) || value.ValueKind != JsonValueKind.String)
            return null;
        var text = value.GetString()?.Trim();
        return string.IsNullOrEmpty(text) ? null : text;
    }
}
