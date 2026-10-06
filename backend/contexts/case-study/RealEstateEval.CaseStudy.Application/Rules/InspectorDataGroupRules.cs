using RealEstateEval.Domain;

namespace RealEstateEval.CaseStudy.Application.Rules;

/// <summary>
/// Batch 2C: the fixed map from a section of the inspector's package to the parties that normally need to
/// re-do their work when that section is sent back. It only SUGGESTS — the specialist decides who is
/// affected. Section keys are <see cref="InspectorDataDigestRules.GroupKeys"/>.
/// </summary>
public static class InspectorDataGroupRules
{
    public sealed record Group(string Key, string LabelAr, IReadOnlyList<string> SuggestedKinds);

    private const string Appraiser = WorkflowTaskKindValues.PropertyAppraisal;
    private const string Office = WorkflowTaskKindValues.EngineeringSurvey;

    /// <summary>Every section, in the digest's order.</summary>
    public static readonly IReadOnlyList<Group> All =
    [
        new(InspectorDataDigestRules.AssetType, "الأصل محل التقييم", [Appraiser]),
        new(InspectorDataDigestRules.Components, "مكونات العقار", [Appraiser]),
        new(InspectorDataDigestRules.Area, "المساحات", [Appraiser, Office]),
        new(InspectorDataDigestRules.Age, "عمر العقار ورخصة البناء", [Appraiser]),
        new(InspectorDataDigestRules.Boundaries, "الحدود ومطابقة الصك", [Office]),
        new(InspectorDataDigestRules.Location, "الموقع والشوارع", [Office, Appraiser]),
        new(InspectorDataDigestRules.Photos, "الصور", [Appraiser]),
        new(InspectorDataDigestRules.Narrative, "الوصف والملاحظات", [Appraiser]),
        new(InspectorDataDigestRules.Services, "الخدمات والمرافق", [Appraiser]),
    ];

    public static Group? Find(string? key) =>
        All.FirstOrDefault(g => string.Equals(g.Key, key?.Trim(), StringComparison.Ordinal));

    /// <summary>
    /// The requested sections resolved to groups (distinct, in the map's order). <paramref name="unknown"/>
    /// receives every key that names no section.
    /// </summary>
    public static IReadOnlyList<Group> Resolve(IEnumerable<string>? keys, out IReadOnlyList<string> unknown)
    {
        var requested = (keys ?? [])
            .Select(k => k?.Trim() ?? "")
            .Where(k => k.Length > 0)
            .Distinct(StringComparer.Ordinal)
            .ToList();
        unknown = requested.Where(k => Find(k) is null).ToList();
        return All.Where(g => requested.Contains(g.Key, StringComparer.Ordinal)).ToList();
    }

    /// <summary>The labels of the requested sections that suggest a party of <paramref name="kind"/>.</summary>
    public static IReadOnlyList<string> SuggestedBecause(string kind, IEnumerable<Group> sections) =>
        sections
            .Where(g => g.SuggestedKinds.Contains(kind, StringComparer.Ordinal))
            .Select(g => g.LabelAr)
            .ToList();
}
