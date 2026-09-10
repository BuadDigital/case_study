using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.Domain;
using Xunit;

namespace RealEstateEval.Application.Tests;

public class CaseStudyFormDeedNatureMatchRulesTests
{
    [Fact]
    public void ValidateForSave_allows_unset_draft()
    {
        Assert.Null(CaseStudyFormDeedNatureMatchRules.ValidateForSave("", null));
        Assert.Null(CaseStudyFormDeedNatureMatchRules.ValidateForSave(null, ""));
    }

    [Fact]
    public void ValidateForSave_rejects_unknown_token()
    {
        var errors = CaseStudyFormDeedNatureMatchRules.ValidateForSave("mismatch", null);
        Assert.NotNull(errors);
        Assert.True(errors!.ContainsKey("deedNatureMatchOutcome"));
    }

    [Theory]
    [InlineData(DeedNatureMatchOutcomes.Differences)]
    [InlineData(DeedNatureMatchOutcomes.Impediment)]
    public void ValidateForSave_requires_notes_for_discrepancy(string outcome)
    {
        var errors = CaseStudyFormDeedNatureMatchRules.ValidateForSave(outcome, "  ");
        Assert.NotNull(errors);
        Assert.True(errors!.ContainsKey("deedNatureMatchNotes"));

        Assert.Null(CaseStudyFormDeedNatureMatchRules.ValidateForSave(outcome, "شرح الفرق"));
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

    [Fact]
    public void ValidateForSubmit_allows_registered_title_without_match()
    {
        Assert.Null(
            CaseStudyFormDeedNatureMatchRules.ValidateForSubmit(
                "",
                null,
                DeedKind.RegisteredTitle));
    }

    [Fact]
    public void ValidateForSubmit_allows_traditional_when_matched()
    {
        Assert.Null(
            CaseStudyFormDeedNatureMatchRules.ValidateForSubmit(
                DeedNatureMatchOutcomes.Matched,
                null,
                DeedKind.Traditional));
    }

    [Theory]
    [InlineData(DeedNatureMatchOutcomes.Unset)]
    [InlineData(DeedNatureMatchOutcomes.Differences)]
    [InlineData(DeedNatureMatchOutcomes.Impediment)]
    public void ValidateForSubmit_blocks_traditional_unless_matched(string outcome)
    {
        var notes = outcome == DeedNatureMatchOutcomes.Unset ? null : "شرح";
        var errors = CaseStudyFormDeedNatureMatchRules.ValidateForSubmit(
            outcome,
            notes,
            DeedKind.Traditional);
        Assert.NotNull(errors);
        Assert.Equal(CaseStudyFormDeedNatureMatchRules.SubmitBlockedAr, errors!["_"]);
    }
}
