using RealEstateEval.Domain;

namespace RealEstateEval.Application.Tests;

public class ValuationReportFieldAdjustmentFlattenRulesTests
{
    [Fact]
    public void ColumnForSlot_maps_three_comps_to_2_4_6()
    {
        Assert.Equal(2, ValuationReportFieldAdjustmentFlattenRules.ColumnForSlot(0));
        Assert.Equal(4, ValuationReportFieldAdjustmentFlattenRules.ColumnForSlot(1));
        Assert.Equal(6, ValuationReportFieldAdjustmentFlattenRules.ColumnForSlot(2));
        Assert.Equal(-1, ValuationReportFieldAdjustmentFlattenRules.ColumnForSlot(3));
    }

    [Fact]
    public void PutSlotCells_writes_financing_location_weight_and_adjusted_ppsm()
    {
        var bag = new Dictionary<string, string?>();
        var lines = new List<ValuationComparableAdjustmentLineDtoLite>
        {
            new(MarketAdjustmentFactorKeys.Financing, 2m, true),
            new(MarketAdjustmentFactorKeys.Market, -1m, true),
            new(MarketAdjustmentFactorKeys.Location, 5m, true),
            new(MarketAdjustmentFactorKeys.Area, 3m, true),
        };

        ValuationReportFieldAdjustmentFlattenRules.PutSlotCells(
            bag,
            slotIndexZeroBased: 0,
            lines,
            priceAfterSequential: 1100m,
            priceAfterDifference: 1188m,
            sumDifferencePct: 8m,
            effectiveWeightPct: 40m);

        Assert.Equal("2", bag["adj.60107"]);
        Assert.Equal("-1", bag["adj.60113"]);
        Assert.Equal("1", bag["adj.60119"]); // 2 + (-1)
        Assert.Equal("5", bag["adj.40013"]);
        Assert.Equal("3", bag["adj.40007"]);
        Assert.Equal("8", bag["adj.40049"]);
        Assert.Equal("1,188.00", bag["adj.40061"]);
        Assert.Equal("40", bag["adj.60188"]);
    }

    [Fact]
    public void PutSlotCells_leaves_time_row_empty_market_only_in_market_row()
    {
        var bag = new Dictionary<string, string?>();
        var lines = new List<ValuationComparableAdjustmentLineDtoLite>
        {
            new(MarketAdjustmentFactorKeys.Market, -3m, true),
        };

        ValuationReportFieldAdjustmentFlattenRules.PutSlotCells(
            bag, 0, lines, 970m, 970m, 0m, 100m);

        Assert.False(bag.ContainsKey("adj.60101"));
        Assert.Equal("-3", bag["adj.60113"]);
    }

    [Fact]
    public void PutSlotCells_excludes_sequential_transaction_type_from_other_difference_row()
    {
        var bag = new Dictionary<string, string?>();
        var lines = new List<ValuationComparableAdjustmentLineDtoLite>
        {
            new(MarketAdjustmentFactorKeys.TransactionType, -5m, true),
            new(MarketAdjustmentFactorKeys.Custom, 2m, true),
        };

        ValuationReportFieldAdjustmentFlattenRules.PutSlotCells(
            bag, 0, lines, 950m, 969m, 2m, 100m);

        Assert.Equal("2", bag["adj.60153"]); // custom only — transaction type is sequential
    }

    [Fact]
    public void PutSharedLabels_does_not_overwrite_computed_street_count()
    {
        var bag = new Dictionary<string, string?>
        {
            ["adj.65441"] = "عدد الشوارع المحسوب: 2",
        };

        ValuationReportFieldAdjustmentFlattenRules.PutSharedLabels(bag);

        Assert.Equal("عدد الشوارع المحسوب: 2", bag["adj.65441"]);
        Assert.Equal("تسويات أخرى", bag["adj.65446"]);
    }
}

public class ArabicAmountWordsTests
{
    [Fact]
    public void AmountToArabicWords_formats_riyals()
    {
        var text = ArabicAmountWords.AmountToArabicWords(1250m);
        Assert.Contains("ريال سعودي", text);
        Assert.Contains("ألف", text);
    }

    [Fact]
    public void AmountToArabicWords_zero()
    {
        Assert.Equal("صفر ريال سعودي", ArabicAmountWords.AmountToArabicWords(0m));
    }

    [Fact]
    public void Catalog_tafqit_is_computed()
    {
        var m = ValuationReportFieldCatalog.Find("65167");
        Assert.NotNull(m);
        Assert.Equal(ValuationReportFieldSourceKind.Computed, m!.SourceKind);
        Assert.Equal("final.opinion_tafqit", m.FieldKey);
    }
}
