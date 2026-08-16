using RealEstateEval.Domain;
using Xunit;

namespace RealEstateEval.Application.Tests;

public class PropertyGroupRulesTests
{
    [Fact]
    public void Same_owner_and_same_plan_signals()
    {
        var subject = new PropertyGroupRules.CandidateInput("محمد العتيبي", "م/123", "45", null, null);
        var candidate = new PropertyGroupRules.CandidateInput("محمد العتيبي", "م/123", "46", null, null);

        var signals = PropertyGroupRules.EvaluateSignals(subject, candidate);
        Assert.Contains(PropertyGroupSignals.SameOwner, signals);
        Assert.Contains(PropertyGroupSignals.SamePlan, signals);
        Assert.Contains(PropertyGroupSignals.AdjacentPlots, signals);
    }

    [Fact]
    public void Adjacency_requires_same_plan_and_consecutive_numeric_plots()
    {
        Assert.True(PropertyGroupRules.ArePlotsAdjacent("45", "46"));
        Assert.False(PropertyGroupRules.ArePlotsAdjacent("45", "47"));
        Assert.False(PropertyGroupRules.ArePlotsAdjacent("45أ", "46"));

        // Different plan → no plan/adjacency signals even for consecutive plots.
        var subject = new PropertyGroupRules.CandidateInput("أ", "م/1", "45", null, null);
        var candidate = new PropertyGroupRules.CandidateInput("ب", "م/2", "46", null, null);
        Assert.Empty(PropertyGroupRules.EvaluateSignals(subject, candidate));
    }

    [Fact]
    public void Coordinate_proximity_signal_within_threshold()
    {
        // ~110m apart (0.001° latitude).
        var subject = new PropertyGroupRules.CandidateInput(null, null, null, 21.5000m, 39.2000m);
        var near = new PropertyGroupRules.CandidateInput(null, null, null, 21.5010m, 39.2000m);
        var far = new PropertyGroupRules.CandidateInput(null, null, null, 21.6000m, 39.2000m);

        Assert.Contains(
            PropertyGroupSignals.CoordinateProximity,
            PropertyGroupRules.EvaluateSignals(subject, near));
        Assert.DoesNotContain(
            PropertyGroupSignals.CoordinateProximity,
            PropertyGroupRules.EvaluateSignals(subject, far));
    }

    [Fact]
    public void Blank_owner_never_matches()
    {
        var subject = new PropertyGroupRules.CandidateInput("  ", null, null, null, null);
        var candidate = new PropertyGroupRules.CandidateInput("", null, null, null, null);
        Assert.Empty(PropertyGroupRules.EvaluateSignals(subject, candidate));
    }
}
