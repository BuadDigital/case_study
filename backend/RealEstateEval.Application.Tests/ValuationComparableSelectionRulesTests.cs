using RealEstateEval.Domain;
using Xunit;
using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Application.Tests;

public class ValuationComparableSelectionRulesTests
{
    [Fact]
    public void MeetsMinimumAdopted_false_when_empty()
    {
        Assert.False(ValuationComparableSelectionRules.MeetsMinimumAdopted(
            Array.Empty<ValuationComparableSelection>()));
    }

    [Fact]
    public void MeetsMinimumAdopted_requires_one_adopted_per_logic_doc()
    {
        var rows = new[]
        {
            new ValuationComparableSelection { IsAdopted = false },
            new ValuationComparableSelection { IsAdopted = false },
        };
        Assert.False(ValuationComparableSelectionRules.MeetsMinimumAdopted(rows));

        rows[1].IsAdopted = true;
        Assert.True(ValuationComparableSelectionRules.MeetsMinimumAdopted(rows));
    }

    [Theory]
    [InlineData(new[] { false, false }, false)]
    [InlineData(new[] { true }, true)]
    [InlineData(new[] { false, true, false }, true)]
    [InlineData(new[] { true, true }, true)]
    public void MeetsMinimumAdopted_flags(bool[] flags, bool expected)
    {
        Assert.Equal(expected, ValuationComparableSelectionRules.MeetsMinimumAdopted(flags));
    }

    [Fact]
    public void Demo_bank_excludes_seed_ids_from_property_link_import()
    {
        var trx = DemoComparableBank.Ids[0];
        var real = Guid.Parse("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee");
        Assert.Equal([real], DemoComparableBank.Exclude([trx, real, trx]));
    }

    [Fact]
    public void Demo_bank_unchosen_means_no_valuer_user_id()
    {
        var trx = DemoComparableBank.Ids[0];
        Assert.True(DemoComparableBank.IsUnchosenDemoSelection(new ValuationComparableSelection
        {
            ComparablePropertyId = trx,
            IsAdopted = true,
        }));
        Assert.False(DemoComparableBank.IsUnchosenDemoSelection(new ValuationComparableSelection
        {
            ComparablePropertyId = trx,
            SelectedByUserId = "valuer-1",
            IsAdopted = true,
        }));
        Assert.False(DemoComparableBank.IsUnchosenDemoSelection(new ValuationComparableSelection
        {
            ComparablePropertyId = Guid.NewGuid(),
        }));
    }
}
