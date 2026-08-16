namespace RealEstateEval.Domain;

/// <summary>Deed-kind rules from the valuation report package (Ejadah).</summary>
public static class DeedKindRules
{
    /// <summary>Registered title: no survey match gate; deed spatial data is definitive.</summary>
    public static bool SkipsSurveyMatchGate(DeedKind kind) =>
        kind == DeedKind.RegisteredTitle;

    /// <summary>Traditional deed: case-study match required before calc.</summary>
    public static bool RequiresDeedNatureMatchGate(DeedKind kind) =>
        kind == DeedKind.Traditional;

    /// <summary>
    /// Whether the valuation engine may run.
    /// Registered title always passes; traditional requires match outcome = matched.
    /// </summary>
    public static bool AllowsValuationCalc(DeedKind deedKind, string? matchOutcome)
    {
        if (SkipsSurveyMatchGate(deedKind))
            return true;
        return (matchOutcome?.Trim() ?? "") == DeedNatureMatchOutcomes.Matched;
    }
}
