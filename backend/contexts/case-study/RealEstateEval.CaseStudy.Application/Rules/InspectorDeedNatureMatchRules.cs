using System.Text.Json;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;

namespace RealEstateEval.CaseStudy.Application.Rules;

/// <summary>
/// The field inspector's explicit verdict on «هل حدود الصك مطابقة للطبيعة؟» before the inspection
/// is submitted. Applies only to a traditional deed (the registered title's boundaries are
/// definitive) and only while the deed boundaries are available. The verdict is a data
/// requirement, so no role bypass skips it.
/// <para>
/// Payload contract: <c>deedMatchesNature</c> = <c>"yes"</c> | <c>"no"</c> | <c>""</c> (empty or
/// missing = not chosen yet) beside the existing
/// <c>boundaryMatches.{north|south|east|west} = { matches, mismatchNote, ... }</c>.
/// A mismatch means at least one side with <c>matches = false</c>, each with a note.
/// </para>
/// </summary>
public static class InspectorDeedNatureMatchRules
{
    public const string VerdictKey = "deedMatchesNature";
    public const string BoundariesKey = "boundaries";

    public const string VerdictRequired = "اختر هل حدود الصك مطابقة للطبيعة أم لا";
    public const string MismatchNeedsASide = "حدّدت أن الحدود غير مطابقة — أشِر إلى الضلع غير المطابق";
    public const string MismatchNeedsNotes = "اكتب ملاحظة لكل ضلع غير مطابق";
    public const string YesContradictsSides = "اخترت «مطابقة» بينما أُشير إلى ضلع غير مطابق";

    private static readonly string[] Sides = ["north", "south", "east", "west"];

    /// <summary>Whether the verdict is asked of this property at all.</summary>
    public static bool Applies(DeedKind deedKind, string? boundariesAvailability) =>
        DeedKindRules.RequiresDeedNatureMatchGate(deedKind)
        && !DocumentaryWorkflowRules.BoundariesUnavailable(boundariesAvailability);

    /// <summary>Error keys (<c>deedMatchesNature</c>, <c>boundaries</c>) to Arabic messages; empty when the verdict is complete or not asked.</summary>
    public static Dictionary<string, string> Validate(
        DeedKind deedKind,
        string? boundariesAvailability,
        JsonElement root)
    {
        var errors = new Dictionary<string, string>();
        if (!Applies(deedKind, boundariesAvailability))
            return errors;

        var verdict = ReadVerdict(root);
        if (verdict is null)
        {
            errors[VerdictKey] = VerdictRequired;
            return errors;
        }

        var mismatched = MismatchedSides(root);
        if (verdict == false)
        {
            if (mismatched.Count == 0)
                errors[BoundariesKey] = MismatchNeedsASide;
            else if (mismatched.Any(side => !side.HasNote))
                errors[BoundariesKey] = MismatchNeedsNotes;
        }
        else if (mismatched.Count > 0)
        {
            errors[BoundariesKey] = YesContradictsSides;
        }

        return errors;
    }

    /// <summary>True = «yes» (matches), false = «no», null = not chosen (empty, missing or unknown).</summary>
    private static bool? ReadVerdict(JsonElement root)
    {
        if (root.ValueKind != JsonValueKind.Object
            || !root.TryGetProperty(VerdictKey, out var value)
            || value.ValueKind != JsonValueKind.String)
        {
            return null;
        }

        return value.GetString()?.Trim().ToLowerInvariant() switch
        {
            "yes" => true,
            "no" => false,
            _ => null,
        };
    }

    private static List<(string Side, bool HasNote)> MismatchedSides(JsonElement root)
    {
        var result = new List<(string, bool)>();
        if (root.ValueKind != JsonValueKind.Object
            || !root.TryGetProperty("boundaryMatches", out var matches)
            || matches.ValueKind != JsonValueKind.Object)
        {
            return result;
        }

        foreach (var side in Sides)
        {
            if (!matches.TryGetProperty(side, out var entry)
                || entry.ValueKind != JsonValueKind.Object
                || !entry.TryGetProperty("matches", out var flag)
                || flag.ValueKind != JsonValueKind.False)
            {
                continue;
            }

            var hasNote = entry.TryGetProperty("mismatchNote", out var note)
                && note.ValueKind == JsonValueKind.String
                && !string.IsNullOrWhiteSpace(note.GetString());
            result.Add((side, hasNote));
        }

        return result;
    }
}
