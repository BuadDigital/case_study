using System.Text.Json;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;

namespace RealEstateEval.CaseStudy.Application.Rules;

/// <summary>
/// The field-level change log of a property's data (Omar's ruling 2026-11-02: every case-specialist
/// sub-role and the appraiser edit property data, «مع الاحتفاظ بسجل للتعديلات للرقابة»).
/// </summary>
/// <remarks>
/// How it works: both snapshots of <see cref="WorkOrderPropertyDto"/> are serialized with the
/// wire options and compared member by member at the top level; a member whose JSON differs is one
/// change, its before/after kept as JSON (lists such as owners or contacts are compared whole).
/// Edge cases: identity, derived and bookkeeping members (ids, transaction numbers, labels computed
/// from other fields, stamps, provenance, removal/cancellation state) are never logged — they change
/// as a consequence, not by an edit; an identical save yields an empty diff, which the caller skips.
/// </remarks>
public static class PropertyFieldChangeRules
{
    public const string AuditAction = "case-study.property.fields-changed";
    public const string AuditEntityType = "WorkOrderProperty";

    private static readonly HashSet<string> Ignored = new(StringComparer.Ordinal)
    {
        "id",
        "transactionId",
        "transactionReferenceNumber",
        "referenceNumber",
        "transactionLinkKind",
        "transactionDeedCount",
        "deedKindLabelAr",
        "suggestedDeedKind",
        "ownershipTypeLabelAr",
        "effectivePropertyType",
        "photoMarks",
        "bourseCompletedByName",
        "bourseCompletedAtUtc",
        "specialistReportExtrasProvenanceJson",
        "isRemoved",
        "removalReason",
        "removedAtUtc",
        "cancelledAtUtc",
        "updatedAtUtc",
    };

    /// <summary>The changed members, keyed by their wire name; empty when nothing an editor touched changed.</summary>
    public static Dictionary<string, AuditValueChange> Diff(WorkOrderPropertyDto before, WorkOrderPropertyDto after)
    {
        var beforeJson = JsonSerializer.SerializeToElement(before, JsonDefaults.Web);
        var afterJson = JsonSerializer.SerializeToElement(after, JsonDefaults.Web);
        var changes = new Dictionary<string, AuditValueChange>(StringComparer.Ordinal);
        foreach (var member in afterJson.EnumerateObject())
        {
            if (Ignored.Contains(member.Name)) continue;
            var previous = beforeJson.TryGetProperty(member.Name, out var p) ? p : default;
            if (SameJson(previous, member.Value)) continue;
            changes[member.Name] = new AuditValueChange(Value(previous), Value(member.Value));
        }

        return changes;
    }

    private static bool SameJson(JsonElement a, JsonElement b) =>
        Normalized(a) == Normalized(b);

    // Absent, null and "" read the same: an emptied optional field and one never filled are equal.
    private static string Normalized(JsonElement e) => e.ValueKind switch
    {
        JsonValueKind.Undefined or JsonValueKind.Null => "",
        JsonValueKind.String => e.GetString()?.Trim() ?? "",
        _ => e.GetRawText(),
    };

    private static object? Value(JsonElement e) => e.ValueKind switch
    {
        JsonValueKind.Undefined or JsonValueKind.Null => null,
        JsonValueKind.String => e.GetString(),
        _ => e.Clone(),
    };
}
