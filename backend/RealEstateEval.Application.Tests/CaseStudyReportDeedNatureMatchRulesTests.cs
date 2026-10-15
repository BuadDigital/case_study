using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.Domain;
using Xunit;

namespace RealEstateEval.Application.Tests;

public class CaseStudyReportDeedNatureMatchRulesTests
{
    [Fact]
    public void ValidateForSave_allows_unset_draft()
    {
        Assert.Null(CaseStudyReportDeedNatureMatchRules.ValidateForSave("", null));
        Assert.Null(CaseStudyReportDeedNatureMatchRules.ValidateForSave(null, ""));
    }

    [Fact]
    public void ValidateForSave_rejects_unknown_token()
    {
        var errors = CaseStudyReportDeedNatureMatchRules.ValidateForSave("mismatch", null);
        Assert.NotNull(errors);
        Assert.True(errors!.ContainsKey("deedNatureMatchOutcome"));
    }

    [Theory]
    [InlineData(DeedNatureMatchOutcomes.Differences)]
    [InlineData(DeedNatureMatchOutcomes.Impediment)]
    public void ValidateForSave_requires_notes_for_discrepancy(string outcome)
    {
        var errors = CaseStudyReportDeedNatureMatchRules.ValidateForSave(outcome, "  ");
        Assert.NotNull(errors);
        Assert.True(errors!.ContainsKey("deedNatureMatchNotes"));

        Assert.Null(CaseStudyReportDeedNatureMatchRules.ValidateForSave(outcome, "شرح الفرق"));
    }

    [Fact]
    public void IsChosen_excludes_unset_while_IsKnown_includes_it()
    {
        Assert.True(DeedNatureMatchOutcomes.IsKnown(DeedNatureMatchOutcomes.Unset));
        Assert.False(DeedNatureMatchOutcomes.IsChosen(DeedNatureMatchOutcomes.Unset));
        Assert.True(DeedNatureMatchOutcomes.IsChosen(DeedNatureMatchOutcomes.Matched));
        Assert.True(DeedNatureMatchOutcomes.RequiresNotes(DeedNatureMatchOutcomes.Differences));
        Assert.False(DeedNatureMatchOutcomes.RequiresNotes(DeedNatureMatchOutcomes.Matched));
    }
}
