using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Application.Tests;

/// <summary>The appraiser's progress ladder: the bar rises with his real work instead of jumping to full at the end.</summary>
public class AppraiserProgressRulesTests
{
    private static int Work(
        bool started = false, bool marketEnabled = true, int market = 0,
        bool costEnabled = true, int land = 0, bool costSaved = false, bool opinion = false) =>
        AppraiserProgressRules.Work(started, marketEnabled, market, costEnabled, land, costSaved, opinion);

    [Fact]
    public void Nothing_done_is_zero_and_starting_is_ten()
    {
        Assert.Equal(0, Work());
        Assert.Equal(AppraiserProgressRules.Started, Work(started: true));
    }

    [Fact]
    public void The_market_approach_needs_an_adopted_comparable()
    {
        Assert.Equal(10, Work(started: true, market: 0));
        Assert.Equal(AppraiserProgressRules.MarketDone, Work(started: true, market: 1));
    }

    [Fact]
    public void The_cost_approach_needs_adopted_land_comparables_and_a_saved_cost()
    {
        Assert.Equal(30, Work(started: true, market: 3, land: 3, costSaved: false));
        Assert.Equal(30, Work(started: true, market: 3, land: 0, costSaved: true));
        Assert.Equal(AppraiserProgressRules.CostDone, Work(started: true, market: 3, land: 3, costSaved: true));
    }

    [Fact]
    public void A_disabled_approach_does_not_hold_the_bar_back()
    {
        Assert.Equal(AppraiserProgressRules.CostDone, Work(started: true, marketEnabled: false, costEnabled: false));
        Assert.Equal(AppraiserProgressRules.CostDone, Work(started: true, market: 1, costEnabled: false));
    }

    [Fact]
    public void A_saved_final_opinion_is_at_least_sixty_five_and_never_lowers_the_bar()
    {
        Assert.Equal(AppraiserProgressRules.OpinionSaved, Work(started: true, market: 1, land: 1, costSaved: true, opinion: true));
        Assert.Equal(AppraiserProgressRules.OpinionSaved, Work(opinion: true));
    }

    [Theory]
    [InlineData(40, "none", "draft", 40)]
    [InlineData(65, "preparing", "draft", 75)]
    [InlineData(65, "sent", "draft", 85)]
    [InlineData(65, "approved", "draft", 92)]
    [InlineData(65, "approved", "deposit_issued", 92)]
    [InlineData(65, "approved", "final_issued", 100)]
    public void The_report_cycle_takes_over_after_the_work(int work, string draft, string stage, int expected) =>
        Assert.Equal(expected, AppraiserProgressRules.Overall(work, draft, stage));

    [Fact]
    public void The_ladder_only_goes_up()
    {
        int[] rungs =
        [
            AppraiserProgressRules.Started, AppraiserProgressRules.MarketDone, AppraiserProgressRules.CostDone,
            AppraiserProgressRules.OpinionSaved, AppraiserProgressRules.HandedOver, AppraiserProgressRules.DraftSent,
            AppraiserProgressRules.Approved, AppraiserProgressRules.FinalIssued,
        ];
        Assert.Equal(rungs.OrderBy(x => x), rungs);
        Assert.Equal(100, rungs[^1]);
    }
}
