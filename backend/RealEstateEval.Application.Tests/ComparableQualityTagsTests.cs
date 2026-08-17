using RealEstateEval.Domain;
using Xunit;

namespace RealEstateEval.Application.Tests;

public class ComparableQualityTagsTests
{
    [Theory]
    [InlineData("normal", true)]
    [InlineData("anomalous", true)]
    [InlineData("unreliable", true)]
    [InlineData("bogus", false)]
    public void Reliability_tags_are_a_closed_list(string value, bool known)
    {
        Assert.Equal(known, ComparableReliabilityTags.IsKnown(value));
    }

    [Fact]
    public void Labels_match_decision_q3_wording()
    {
        Assert.Equal("عادي", ComparableReliabilityTags.LabelAr("normal"));
        Assert.Equal("شاذ", ComparableReliabilityTags.LabelAr("anomalous"));
        Assert.Equal("غير موثوق", ComparableReliabilityTags.LabelAr("unreliable"));
        Assert.Equal(ComparableReliabilityTags.Normal, ComparableReliabilityTags.Normalize("xxx"));
    }

    [Fact]
    public void Tagged_records_are_excluded_from_suggestions_but_never_deleted()
    {
        var normal = new ComparableProperty();
        Assert.False(normal.IsExcludedFromSuggestions);

        var anomalous = new ComparableProperty
        {
            ReliabilityTag = ComparableReliabilityTags.Anomalous,
        };
        Assert.True(anomalous.IsExcludedFromSuggestions);
        Assert.True(anomalous.IsActive);

        var duplicate = new ComparableProperty { IsDuplicateTagged = true };
        Assert.True(duplicate.IsExcludedFromSuggestions);
    }
}
