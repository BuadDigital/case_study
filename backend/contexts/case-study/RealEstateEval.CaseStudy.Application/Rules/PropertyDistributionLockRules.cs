using RealEstateEval.Application.Contracts;

namespace RealEstateEval.CaseStudy.Application.Rules;

/// <summary>
/// The initial-data fields the parties work from, locked once the deed's distribution is confirmed
/// (Omar 2026-11-15, option 2): the deed / registry number and date, the area, the boundaries, the
/// map link, and the type and classification. Administrative fields (contacts, request number,
/// documents, owner, court …) stay editable.
/// </summary>
/// <remarks>
/// How it works: <see cref="Errors"/> diffs the property before and after a save with
/// <see cref="PropertyFieldChangeRules.Diff"/> — the same normalised comparison the change log uses —
/// and keeps only the locked keys, one Arabic error per changed field under its own key, so the
/// screen marks the field. Edge cases: an unchanged locked field (an autosave that re-sends it) passes;
/// the inspector's accepted boundary corrections and the inspected-type change write through their own
/// paths and are not checked here.
/// </remarks>
public static class PropertyDistributionLockRules
{
    public const string LockedMessage = "لا يُعدَّل بعد توزيع المعاملة على الأطراف";

    /// <summary>Locked keys, as the property DTO names them on the wire (camelCase).</summary>
    public static readonly IReadOnlySet<string> LockedKeys = new HashSet<string>(StringComparer.Ordinal)
    {
        "identifierType",
        "deedNumber",
        "deedDate",
        "realEstateRegNumber",
        "realEstateRegDate",
        "area",
        "locationMapUrl",
        "propertyType",
        "classification",
        "boundariesAvailability",
        "boundariesExternalDocName",
        "northBoundary", "northBoundaryLengthM", "northBoundaryType", "northFacadeFinishing",
        "southBoundary", "southBoundaryLengthM", "southBoundaryType", "southFacadeFinishing",
        "eastBoundary", "eastBoundaryLengthM", "eastBoundaryType", "eastFacadeFinishing",
        "westBoundary", "westBoundaryLengthM", "westBoundaryType", "westFacadeFinishing",
    };

    /// <summary>One error per locked field the save would change; empty when none.</summary>
    public static Dictionary<string, string> Errors(WorkOrderPropertyDto before, WorkOrderPropertyDto after) =>
        PropertyFieldChangeRules.Diff(before, after).Keys
            .Where(LockedKeys.Contains)
            .ToDictionary(key => key, _ => LockedMessage, StringComparer.Ordinal);
}
