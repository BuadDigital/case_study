namespace RealEstateEval.Domain;

/// <summary>Deed-kind rules from the valuation report package (Ejadah).</summary>
public static class DeedKindRules
{
 /// <summary>Registered title: no survey match gate; deed spatial data is definitive.</summary>
    public static bool SkipsSurveyMatchGate(DeedKind kind) =>
        kind == DeedKind.RegisteredTitle;

    /// <summary>Traditional deed: match required before valuation and the case-study report.</summary>
    public static bool RequiresDeedNatureMatchGate(DeedKind kind) =>
        kind == DeedKind.Traditional;

 /// <summary>
 /// Downstream professional work: valuation calc and the case-study report.
 /// Registered title always passes; traditional requires match outcome = matched.
 /// فروق / تعذر is an impediment path, not a pass.
 /// </summary>
    public static bool AllowsValuationCalc(DeedKind deedKind, string? matchOutcome)
    {
        if (SkipsSurveyMatchGate(deedKind))
            return true;
        return (matchOutcome?.Trim() ?? "") == DeedNatureMatchOutcomes.Matched;
    }

    /// <inheritdoc cref="AllowsValuationCalc"/>
    public static bool AllowsCaseStudyReport(DeedKind deedKind, string? matchOutcome) =>
        AllowsValuationCalc(deedKind, matchOutcome);
}
