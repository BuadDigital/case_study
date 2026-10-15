using RealEstateEval.Domain;

namespace RealEstateEval.CaseStudy.Application.Rules;

/// <summary>
/// Validity of the deed↔nature match field on the case-study report (save and issue alike):
/// Unset is allowed, unknown tokens are rejected, فروق/تعذر need notes. The match is not a
/// condition for issuing the report (decision 2026-10-15); the valuation side keeps its own
/// rule (<see cref="DeedKindRules.AllowsValuationCalc"/>).
/// </summary>
public static class CaseStudyReportDeedNatureMatchRules
{
    public static Dictionary<string, string>? ValidateForSave(
        string? outcome,
        string? notes)
    {
        var matchOutcome = (outcome ?? "").Trim().ToLowerInvariant();
        // IsKnown includes Unset — draft-friendly; matched is for submit / valuation.
        if (!DeedNatureMatchOutcomes.IsKnown(matchOutcome))
        {
            return new Dictionary<string, string>
            {
                ["deedNatureMatchOutcome"] = "مخرج المطابقة غير معروف",
            };
        }

        if (DeedNatureMatchOutcomes.RequiresNotes(matchOutcome)
            && string.IsNullOrWhiteSpace(notes))
        {
            return new Dictionary<string, string>
            {
                ["deedNatureMatchNotes"] = "ملاحظات المطابقة إلزامية عند «فروق» أو «مرشح تعذّر»",
            };
        }

        return null;
    }
}
