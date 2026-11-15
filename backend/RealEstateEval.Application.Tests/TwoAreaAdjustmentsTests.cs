using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Application.Rules;
using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// A built subject's two area lines (Omar 2026-11-15: «تسويات المساحتين — الأرض والمباني — كل مساحة
/// لها بند مستقل أحدها اختياري، ويسري على كل واحد منها مبدأ المضاعف والأمثال»): each line has its
/// own areas, factor and method; a smaller comparable is raised on a whole value; both count in the
/// gross adjustment; one of the two may be left out, never both.
/// </summary>
public class TwoAreaAdjustmentsTests
{
    private static readonly Guid VrId = Guid.Parse("e5000000-0000-4000-8000-000000000001");
    private static readonly DateOnly Date = new(2026, 11, 1);

    // ─── The direction of one area line ───

    [Fact]
    public void A_smaller_comparable_is_lowered_per_metre_and_raised_on_a_whole_value()
    {
        // Subject 400 m², comparable 300 m² — multiples: (400 − 300) ÷ 300 × 5 = 1.67.
        Assert.Equal(-1.67m, AreaAdjustmentRules.SuggestPct("amthal", 400m, 300m, 5m));
        Assert.Equal(1.67m, AreaAdjustmentRules.SuggestPct("amthal", 400m, 300m, 5m, onWholeValue: true));
    }

    [Fact]
    public void A_larger_comparable_is_raised_per_metre_and_lowered_on_a_whole_value()
    {
        // Subject 400 m², comparable 800 m² — multiplier: round(log₂ 2) × 5 = 5.
        Assert.Equal(5m, AreaAdjustmentRules.SuggestPct("multiplier", 400m, 800m, 5m));
        Assert.Equal(-5m, AreaAdjustmentRules.SuggestPct("multiplier", 400m, 800m, 5m, onWholeValue: true));
    }

    [Fact]
    public void A_missing_area_or_equal_areas_give_no_adjustment_either_way()
    {
        Assert.Equal(0m, AreaAdjustmentRules.SuggestPct("amthal", 400m, 0m, 5m, onWholeValue: true));
        Assert.Equal(0m, AreaAdjustmentRules.SuggestPct("amthal", 0m, 300m, 5m, onWholeValue: true));
        Assert.Equal(0m, AreaAdjustmentRules.SuggestPct("amthal", 400m, 400m, 5m, onWholeValue: true));
    }

    // ─── The table of a built subject ───

    [Fact]
    public void A_villa_against_villas_gets_both_lines_each_with_its_own_areas_factor_and_method()
    {
        // Subject villa: building 400 m² on 600 m² of land. Building factor 5٪, land factor 10٪.
        //   #1 building 300, land 500 · #2 building 500, land 1,500.
        // Building line — largest ratio 400 ÷ 300 = 1.33 → multiples:
        //   #1 (400 − 300) ÷ 300 × 5 = +1.67 · #2 (500 − 400) ÷ 400 × 5 = −1.25.
        // Land line — largest ratio 1,500 ÷ 600 = 2.5 → multiplier, on its own:
        //   #1 round(log₂ 1.2) = 0 → 0 · #2 round(log₂ 2.5) = 1 → −10.
        var list = Villas(Header(landFactor: 10m));

        Assert.True(list.TwoAreaAdjustments);
        Assert.Equal(600m, list.SubjectLandAreaSqm);
        Assert.Equal(10m, list.LandAreaFactorPct);
        Assert.Equal(["amthal", "amthal"], list.Items.Select(i => i.Market!.AreaAdjustmentMethod));
        Assert.Equal(["multiplier", "multiplier"], list.Items.Select(i => i.Market!.LandAreaAdjustmentMethod));
        Assert.Equal([1.67m, -1.25m], list.Items.Select(i => i.Market!.SuggestedAreaAdjustmentPct));
        Assert.Equal([0m, -10m], list.Items.Select(i => i.Market!.SuggestedLandAreaAdjustmentPct));
        // The whole prices are adjusted: 1,000,000 × 1.0167 and 2,000,000 × (1 − 0.1125).
        Assert.Equal([1_016_700m, 1_775_000m], list.Items.Select(i => i.Market!.PricePerSqmAfterDifference));
    }

    [Fact]
    public void Both_lines_count_in_the_gross_adjustment()
    {
        var list = Villas(Header(landFactor: 10m));
        // #2: |−1.25| + |−10| = 11.25.
        Assert.Equal([1.67m, 11.25m], list.Items.Select(i => i.Market!.GrossAdjustmentPct()));
    }

    [Fact]
    public void A_line_the_appraiser_leaves_out_is_not_applied_and_not_counted()
    {
        var (rows, comps) = VillaRows();
        foreach (var row in rows)
            row.AdjustmentLines.Add(Line(row.Id, MarketAdjustmentFactorKeys.LandArea, included: false));

        var list = Build(rows, comps, Header(landFactor: 10m));

        // Only the building line is left: +1.67 and −1.25.
        Assert.Equal([1_016_700m, 1_975_000m], list.Items.Select(i => i.Market!.PricePerSqmAfterDifference));
        Assert.Equal([1.67m, 1.25m], list.Items.Select(i => i.Market!.GrossAdjustmentPct()));
        // The line still says what it would have been.
        Assert.Equal([0m, -10m], list.Items.Select(i => i.Market!.SuggestedLandAreaAdjustmentPct));
    }

    [Fact]
    public void The_land_line_is_there_for_a_comparable_saved_before_it_existed()
    {
        var list = Villas(Header());
        foreach (var item in list.Items)
        {
            var keys = item.Market!.AdjustmentLines.Select(l => l.FactorKey).ToList();
            var land = item.Market.AdjustmentLines.Single(l => l.FactorKey == MarketAdjustmentFactorKeys.LandArea);
            Assert.True(land.IsIncluded);
            Assert.Equal("تسوية مساحة الأرض", land.LabelAr);
            // Right after the building's line.
            Assert.Equal(keys.IndexOf(MarketAdjustmentFactorKeys.Area) + 1, keys.IndexOf(MarketAdjustmentFactorKeys.LandArea));
        }
    }

    [Fact]
    public void A_comparable_with_no_land_area_gets_no_land_adjustment_until_one_is_entered()
    {
        var (rows, comps) = VillaRows();
        comps[rows[1].ComparablePropertyId].LandAreaSqm = null;

        var before = Build(rows, comps, Header(landFactor: 10m));
        Assert.Null(before.Items[1].EffectiveLandAreaSqm);
        Assert.Equal(0m, before.Items[1].Market!.SuggestedLandAreaAdjustmentPct);

        // Entered on this valuation only — the bank keeps its own.
        rows[1].LandAreaOverrideSqm = 1_500m;
        var after = Build(rows, comps, Header(landFactor: 10m));
        Assert.Equal(1_500m, after.Items[1].EffectiveLandAreaSqm);
        Assert.Equal(-10m, after.Items[1].Market!.SuggestedLandAreaAdjustmentPct);
    }

    [Fact]
    public void This_valuations_land_area_wins_over_the_banks()
    {
        var (rows, comps) = VillaRows();
        rows[0].LandAreaOverrideSqm = 300m; // the bank says 500
        var list = Build(rows, comps, Header(landFactor: 10m));
        Assert.Equal(300m, list.Items[0].EffectiveLandAreaSqm);
        // 600 ÷ 300 = 2 → one step of 10٪, raised: the comparable stands on the smaller plot.
        Assert.Equal(10m, list.Items[0].Market!.SuggestedLandAreaAdjustmentPct);
    }

    [Fact]
    public void Without_the_subjects_land_area_the_land_line_gives_nothing()
    {
        var list = Villas(Header(subjectLand: null));
        Assert.Equal([0m, 0m], list.Items.Select(i => i.Market!.SuggestedLandAreaAdjustmentPct));
        Assert.Equal([1.67m, -1.25m], list.Items.Select(i => i.Market!.SuggestedAreaAdjustmentPct));
    }

    [Fact]
    public void On_the_per_metre_basis_the_building_line_lowers_the_smaller_and_the_land_line_still_raises_it()
    {
        // Per m² of building: the building's line adjusts the price of its own metre (a smaller
        // building has the dearer metre → lowered); the land is not that metre, so its line raises
        // the comparable on the smaller plot.
        var (rows, comps) = VillaRows();
        rows[0].LandAreaOverrideSqm = 300m;
        var list = Build(rows, comps, Header(MarketAdjustmentBasisKeys.PricePerSqm, landFactor: 10m));

        Assert.Equal(-1.67m, list.Items[0].Market!.SuggestedAreaAdjustmentPct);
        Assert.Equal(10m, list.Items[0].Market!.SuggestedLandAreaAdjustmentPct);
    }

    [Fact]
    public void The_subjects_land_area_comes_from_the_deed_until_the_appraiser_types_one()
    {
        var (rows, comps) = VillaRows();
        var fromDeed = ValuationComparableListBuilder.BuildList(
            Request(), rows, comps, Date, Header(subjectLand: null), "market", [],
            subjectIsBuilt: true, deedLandAreaSqm: 600m);
        Assert.Equal(600m, fromDeed.SubjectLandAreaSqm);
        Assert.False(fromDeed.SubjectLandAreaIsManual);
        Assert.Equal(-5m, fromDeed.Items[1].Market!.SuggestedLandAreaAdjustmentPct);

        var typed = ValuationComparableListBuilder.BuildList(
            Request(), rows, comps, Date, Header(subjectLand: 1_500m), "market", [],
            subjectIsBuilt: true, deedLandAreaSqm: 600m);
        Assert.Equal(1_500m, typed.SubjectLandAreaSqm);
        Assert.True(typed.SubjectLandAreaIsManual);
        Assert.Equal(0m, typed.Items[1].Market!.SuggestedLandAreaAdjustmentPct);
    }

    [Fact]
    public void A_buildings_deed_gives_its_land_area_and_a_units_deed_does_not()
    {
        Assert.Equal(600m, SubjectLandRules.DeedLandAreaOfBuiltSubject("فيلا", "600"));
        Assert.Equal(1250.5m, SubjectLandRules.DeedLandAreaOfBuiltSubject("عمارة", "1,250.5"));
        // The deed of a unit states the unit's own area, not a land.
        Assert.Null(SubjectLandRules.DeedLandAreaOfBuiltSubject("شقة", "180"));
        Assert.Null(SubjectLandRules.DeedLandAreaOfBuiltSubject("شقة سكنية", "180"));
        Assert.Null(SubjectLandRules.DeedLandAreaOfBuiltSubject("محل تجاري", "90"));
        Assert.Null(SubjectLandRules.DeedLandAreaOfBuiltSubject("فيلا", ""));
        Assert.Null(SubjectLandRules.DeedLandAreaOfBuiltSubject("فيلا", "غير معروف"));
    }

    // ─── What does not change ───

    [Fact]
    public void A_valuation_begun_before_the_two_lines_keeps_no_area_adjustment_on_whole_values()
    {
        var list = Villas(Header(twoAreas: false));

        Assert.False(list.TwoAreaAdjustments);
        Assert.Equal([0m, 0m], list.Items.Select(i => i.Market!.SuggestedAreaAdjustmentPct));
        Assert.Equal([1_000_000m, 2_000_000m], list.Items.Select(i => i.Market!.PricePerSqmAfterDifference));
        Assert.DoesNotContain(
            list.Items.SelectMany(i => i.Market!.AdjustmentLines),
            l => l.FactorKey == MarketAdjustmentFactorKeys.LandArea);
    }

    [Fact]
    public void A_land_subject_keeps_its_single_area_line()
    {
        var (rows, comps) = VillaRows();
        var list = ValuationComparableListBuilder.BuildList(
            Request("أرض"), rows, comps, Date, Header(MarketAdjustmentBasisKeys.PricePerSqm), "market", [],
            subjectIsBuilt: false);

        Assert.False(list.TwoAreaAdjustments);
        Assert.Null(list.SubjectLandAreaSqm);
        Assert.DoesNotContain(
            list.Items.SelectMany(i => i.Market!.AdjustmentLines),
            l => l.FactorKey == MarketAdjustmentFactorKeys.LandArea);
        // The one line, per metre, as before: the smaller comparable lowered.
        Assert.Equal(-1.67m, list.Items[0].Market!.SuggestedAreaAdjustmentPct);
    }

    [Fact]
    public void The_land_table_inside_the_cost_approach_has_no_land_line()
    {
        var (rows, comps) = VillaRows("land_within_cost");
        var list = ValuationComparableListBuilder.BuildList(
            Request(), rows, comps, Date, Header(), "land_within_cost", [], subjectIsBuilt: true);

        Assert.False(list.TwoAreaAdjustments);
        Assert.DoesNotContain(
            list.Items.SelectMany(i => i.Market!.AdjustmentLines),
            l => l.FactorKey == MarketAdjustmentFactorKeys.LandArea);
    }

    // ─── Saving ───

    [Fact]
    public void One_of_the_two_lines_may_be_left_out_but_not_both()
    {
        Assert.Empty(Validate(area: true, land: false));
        Assert.Empty(Validate(area: false, land: true));
        Assert.Empty(Validate(area: true, land: true));
        var errors = Validate(area: false, land: false);
        Assert.Equal(
            ValuationComparableSelectionRequestRules.BothAreaLinesLeftOutAr,
            errors["areaAdjustments"]);
    }

    [Fact]
    public void Leaving_the_building_line_out_is_fine_while_the_land_line_was_never_saved()
    {
        // A comparable saved before the land line existed has none; the server adds it switched on.
        Assert.Empty(Validate(area: false, land: null));
    }

    [Fact]
    public void The_rule_is_asked_of_a_built_subjects_table_only()
    {
        Assert.Empty(Validate(area: false, land: false, twoAreaLines: false));
    }

    [Fact]
    public void The_two_area_lines_are_left_out_of_the_typed_difference_sum()
    {
        // −60 typed plus a computed line sent with any number must not trip the −100٪ guard.
        var request = new SaveValuationComparableMarketRequest
        {
            AdjustmentLines =
            [
                Save(MarketAdjustmentFactorKeys.Location, -60m),
                Save(MarketAdjustmentFactorKeys.Area, -30m),
                Save(MarketAdjustmentFactorKeys.LandArea, -30m),
            ],
        };
        Assert.Empty(ValuationComparableSelectionRequestRules.ValidateMarketSave(request, twoAreaLines: true));
    }

    [Fact]
    public void A_comparables_land_area_on_the_valuation_must_be_a_real_area()
    {
        Assert.Contains(
            "landAreaOverrideSqm",
            ValuationComparableSelectionRequestRules.ValidateMarketSave(new() { LandAreaOverrideSqm = 0m }).Keys);
        Assert.Contains(
            "landAreaOverrideSqm",
            ValuationComparableSelectionRequestRules.ValidateMarketSave(new() { LandAreaOverrideSqm = 20_000_000m }).Keys);
        Assert.Empty(ValuationComparableSelectionRequestRules.ValidateMarketSave(new() { LandAreaOverrideSqm = 500m }));
    }

    [Fact]
    public void Saving_a_comparable_keeps_or_clears_its_land_area_for_this_valuation()
    {
        var row = new ValuationComparableSelection { Id = Guid.NewGuid() };
        ValuationComparableSelectionRequestRules.ApplyMarketSave(row, new() { LandAreaOverrideSqm = 450m });
        Assert.Equal(450m, row.LandAreaOverrideSqm);
        ValuationComparableSelectionRequestRules.ApplyMarketSave(row, new());
        Assert.Null(row.LandAreaOverrideSqm);
    }

    // ─── The header ───

    [Fact]
    public void A_new_header_opens_with_the_two_lines_and_the_land_factor_on_the_organizations()
    {
        var header = ValuationComparableSelectionRequestRules.SeedMarketApproach(
            VrId, new OrganizationValuationSettingsDto { AreaFactorPct = 7m }, "فيلا");
        Assert.True(header.TwoAreaAdjustments);
        Assert.Equal(7m, header.AreaFactorPct);
        Assert.Equal(7m, header.LandAreaFactorPct);
    }

    [Fact]
    public void The_land_factor_and_the_subjects_land_area_are_saved_apart_from_the_buildings()
    {
        var header = Header();
        ValuationComparableSelectionRequestRules.ApplyMarketApproach(header, new()
        {
            SubjectAreaSqm = 400m,
            AreaFactorPct = 4m,
            SubjectLandAreaSqm = 750m,
            LandAreaFactorPct = 12m,
        });
        Assert.Equal(4m, header.AreaFactorPct);
        Assert.Equal(12m, header.LandAreaFactorPct);
        Assert.Equal(750m, header.SubjectLandAreaSqm);
    }

    [Fact]
    public void A_header_save_that_does_not_send_the_land_area_keeps_it_and_zero_clears_it()
    {
        var header = Header();
        ValuationComparableSelectionRequestRules.ApplyMarketApproach(header, new() { SubjectAreaSqm = 400m });
        Assert.Equal(600m, header.SubjectLandAreaSqm);
        ValuationComparableSelectionRequestRules.ApplyMarketApproach(
            header, new() { SubjectAreaSqm = 400m, SubjectLandAreaSqm = 0m });
        Assert.Null(header.SubjectLandAreaSqm);
    }

    [Fact]
    public void The_land_factor_and_land_area_are_bounded_like_the_buildings()
    {
        var errors = ValuationComparableSelectionRequestRules.ValidateMarketApproach(new()
        {
            SubjectAreaSqm = 400m,
            SubjectLandAreaSqm = -1m,
            LandAreaFactorPct = 60m,
        });
        Assert.NotNull(errors);
        Assert.Contains("subjectLandAreaSqm", errors!.Keys);
        Assert.Contains("landAreaFactorPct", errors.Keys);
    }

    // ─── Helpers ───

    private static ValuationComparableSelectionListDto Villas(ValuationMarketApproach header)
    {
        var (rows, comps) = VillaRows();
        return Build(rows, comps, header);
    }

    private static ValuationComparableSelectionListDto Build(
        List<ValuationComparableSelection> rows,
        Dictionary<Guid, ComparableProperty> comps,
        ValuationMarketApproach header) =>
        ValuationComparableListBuilder.BuildList(
            Request(), rows, comps, Date, header, "market", [], subjectIsBuilt: true);

    private static (List<ValuationComparableSelection> Rows, Dictionary<Guid, ComparableProperty> Comps) VillaRows(
        string context = "market")
    {
        var comps = new[]
        {
            Villa(1, building: 300m, land: 500m, price: 1_000_000m),
            Villa(2, building: 500m, land: 1_500m, price: 2_000_000m),
        };
        var rows = comps.Select((c, i) => Row(c, i, context)).ToList();
        return (rows, comps.ToDictionary(c => c.Id));
    }

    private static ComparableProperty Villa(int n, decimal building, decimal land, decimal price) => new()
    {
        Id = Guid.Parse($"e5000000-0000-4000-8000-0000000001{n:00}"),
        ReferenceCode = $"CMP-2A-{n}",
        ComparablePropertyType = "فيلا",
        Usage = "سكني",
        TransactionKind = ComparableTransactionKinds.Executed,
        Source = ComparableSources.Other,
        District = "الملقا",
        AreaSqm = building,
        LandAreaSqm = land,
        Price = price,
        PricePerSqm = Math.Round(price / building, 2),
        Latitude = 24.8m,
        Longitude = 46.6m,
        TransactionDate = Date,
    };

    private static ValuationComparableSelection Row(ComparableProperty comp, int order, string context)
    {
        var id = Guid.NewGuid();
        return new ValuationComparableSelection
        {
            Id = id,
            ValuationRequestId = VrId,
            ComparablePropertyId = comp.Id,
            SelectionContext = context,
            SortOrder = order,
            IsAdopted = true,
            // As saved before the land line existed: the standard lines only.
            AdjustmentLines = MarketApproachRules.CreateStandardMarketLines(id).ToList(),
        };
    }

    private static ValuationComparableAdjustmentLine Line(Guid selectionId, string key, bool included) => new()
    {
        Id = Guid.NewGuid(),
        SelectionId = selectionId,
        FactorKey = key,
        LabelAr = MarketAdjustmentFactorKeys.DefaultLabelAr(key),
        IsIncluded = included,
        SortOrder = 11,
    };

    private static ValuationRequest Request(string type = "فيلا") =>
        ValuationRequest.Create(VrId, "VR-2A", Guid.NewGuid(), "الرياض", type, "مقيم", "2026-11-15", DateTime.UtcNow);

    private static ValuationMarketApproach Header(
        string basis = MarketAdjustmentBasisKeys.WholeProperty,
        decimal landFactor = 5m,
        decimal? subjectLand = 600m,
        bool twoAreas = true) => new()
    {
        Id = Guid.NewGuid(),
        ValuationRequestId = VrId,
        SubjectAreaSqm = 400m,
        AdjustmentBasis = basis,
        AreaFactorPct = 5m,
        TwoAreaAdjustments = twoAreas,
        SubjectLandAreaSqm = subjectLand,
        LandAreaFactorPct = landFactor,
    };

    private static Dictionary<string, string> Validate(bool area, bool? land, bool twoAreaLines = true)
    {
        var lines = new List<SaveValuationComparableAdjustmentLineRequest>
        {
            Save(MarketAdjustmentFactorKeys.Area, 0m, area),
        };
        if (land is { } landIncluded)
            lines.Add(Save(MarketAdjustmentFactorKeys.LandArea, 0m, landIncluded));
        return ValuationComparableSelectionRequestRules.ValidateMarketSave(
            new SaveValuationComparableMarketRequest { AdjustmentLines = lines }, twoAreaLines);
    }

    private static SaveValuationComparableAdjustmentLineRequest Save(string key, decimal percent, bool included = true) =>
        new() { FactorKey = key, Percent = percent, IsIncluded = included };
}
