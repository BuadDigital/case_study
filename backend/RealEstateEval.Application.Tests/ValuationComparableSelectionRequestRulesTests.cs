using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Application.Rules;
using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Application.Tests;

public class ValuationComparableSelectionRequestRulesTests
{
    private static readonly Guid A = Guid.Parse("a0000000-0000-4000-8000-000000000001");
    private static readonly Guid B = Guid.Parse("a0000000-0000-4000-8000-000000000002");
    private static readonly Guid C = Guid.Parse("a0000000-0000-4000-8000-000000000003");

    private static ValuationComparableSelectionItemRequest Item(Guid id, int sortOrder = 0) =>
        new() { ComparablePropertyId = id, SortOrder = sortOrder };

    private static SaveValuationComparableAdjustmentLineRequest Line(
        string factorKey = MarketAdjustmentFactorKeys.Financing,
        decimal percent = 0m,
        string? labelAr = null,
        string? rationale = null,
        int sortOrder = 0,
        Guid? id = null) => new()
        {
            Id = id,
            FactorKey = factorKey,
            Percent = percent,
            LabelAr = labelAr,
            Rationale = rationale,
            SortOrder = sortOrder,
        };

    // ---- replace list ----

    [Fact]
    public void ValidateReplaceItems_flags_empty_and_duplicate_ids()
    {
        var (ids, errors) = ValuationComparableSelectionRequestRules.ValidateReplaceItems(
            [Item(A), Item(Guid.Empty), Item(A), Item(B)]);

        Assert.Equal("معرّف المقارن مطلوب", errors["items[1].comparablePropertyId"]);
        Assert.Equal("مقارن مكرر في القائمة", errors["items[2].comparablePropertyId"]);
        Assert.Equal(2, errors.Count);
        Assert.Equal([A, B], ids);
    }

    [Fact]
    public void ValidateReplaceItems_clean_list_has_no_errors()
    {
        var (ids, errors) = ValuationComparableSelectionRequestRules.ValidateReplaceItems(
            [Item(B), Item(A)]);

        Assert.Empty(errors);
        Assert.Equal([B, A], ids);
    }

    [Fact]
    public void MissingActiveComparableErrors_reports_only_inactive_ids()
    {
        var errors = ValuationComparableSelectionRequestRules.MissingActiveComparableErrors(
            [A, B, C], new HashSet<Guid> { B });

        Assert.Equal(2, errors.Count);
        Assert.Equal("المقارن غير موجود أو معطّل", errors[A.ToString()]);
        Assert.Equal("المقارن غير موجود أو معطّل", errors[C.ToString()]);
        Assert.False(errors.ContainsKey(B.ToString()));
    }

    [Fact]
    public void OrderReplaceItems_sorts_by_sort_order_then_request_position()
    {
        var ordered = ValuationComparableSelectionRequestRules.OrderReplaceItems(
            [Item(A, 5), Item(B, 1), Item(C, 5)]);

        Assert.Equal([B, A, C], ordered.Select(x => x.ComparablePropertyId));
    }

    // ---- per-comparable market save ----

    [Fact]
    public void ValidateMarketSave_accepts_a_clean_request()
    {
        var errors = ValuationComparableSelectionRequestRules.ValidateMarketSave(new()
        {
            AdjustmentLines = [Line(percent: 3m), Line(MarketAdjustmentFactorKeys.Custom, labelAr: "عامل")],
            WeightIsManual = true,
            WeightPct = 40m,
            WeightOverrideRationale = "مبرر الوزن اليدوي كافٍ",
            PriceOverrideSar = 0m,
            AreaOverrideSqm = 250m,
            AreaAdjustmentMethod = "amthal",
        });

        Assert.Empty(errors);
    }

    [Fact]
    public void ValidateMarketSave_flags_line_problems_by_index()
    {
        var errors = ValuationComparableSelectionRequestRules.ValidateMarketSave(new()
        {
            AdjustmentLines =
            [
                Line("bogus"),
                Line(MarketAdjustmentFactorKeys.Custom, labelAr: "  "),
                Line(percent: 101m),
                Line(percent: -101m, rationale: "قصير"),
            ],
        });

        Assert.Equal("عامل تسوية غير معروف", errors["adjustmentLines[0].factorKey"]);
        Assert.Equal("تسمية العامل المضاف مطلوبة", errors["adjustmentLines[1].labelAr"]);
        Assert.Equal("النسبة يجب أن تكون بين -100 و 100", errors["adjustmentLines[2].percent"]);
        Assert.Equal("النسبة يجب أن تكون بين -100 و 100", errors["adjustmentLines[3].percent"]);
        Assert.Equal(
            JustificationRules.TooShortMessageAr("مبرر التسوية للمقارن"),
            errors["adjustmentLines[3].rationale"]);
        Assert.Equal(5, errors.Count);
    }

    [Theory]
    [InlineData(null, "الوزن اليدوي مطلوب")]
    [InlineData("150", "الوزن يجب أن يكون بين 0 و 100")]
    [InlineData("-1", "الوزن يجب أن يكون بين 0 و 100")]
    public void ValidateMarketSave_manual_weight_needs_a_value_in_range(string? weight, string expected)
    {
        var errors = ValuationComparableSelectionRequestRules.ValidateMarketSave(new()
        {
            WeightIsManual = true,
            WeightPct = weight is null ? null : decimal.Parse(weight),
            WeightOverrideRationale = ".",
        });

        Assert.Equal(expected, errors["weightPct"]);
        Assert.Equal(
            JustificationRules.TooShortMessageAr("مبرر الوزن اليدوي"),
            errors["weightOverrideRationale"]);
    }

    [Fact]
    public void ValidateMarketSave_ignores_weight_fields_when_not_manual()
    {
        var errors = ValuationComparableSelectionRequestRules.ValidateMarketSave(new()
        {
            WeightIsManual = false,
            WeightPct = 500m,
            WeightOverrideRationale = ".",
        });

        Assert.Empty(errors);
    }

    [Fact]
    public void ValidateMarketSave_flags_overrides_and_unknown_area_method()
    {
        var errors = ValuationComparableSelectionRequestRules.ValidateMarketSave(new()
        {
            PriceOverrideSar = -1m,
            AreaOverrideSqm = 0m,
            AreaAdjustmentMethod = "cubic",
        });

        Assert.Equal("سعر العقار يجب أن يكون ≥ 0", errors["priceOverrideSar"]);
        Assert.Equal("مساحة المقارن يجب أن تكون أكبر من صفر", errors["areaOverrideSqm"]);
        Assert.Equal("طريقة قياس تسوية المساحة غير معروفة", errors["areaAdjustmentMethod"]);
        Assert.Equal(3, errors.Count);
    }

    [Fact]
    public void BuildAdjustmentLine_keeps_standard_label_and_accepts_custom_label()
    {
        var selectionId = Guid.NewGuid();

        var standard = ValuationComparableSelectionRequestRules.BuildAdjustmentLine(
            selectionId, Line(MarketAdjustmentFactorKeys.Location, labelAr: "mangled"), 3);
        Assert.Equal(MarketAdjustmentFactorKeys.DefaultLabelAr(MarketAdjustmentFactorKeys.Location), standard.LabelAr);
        Assert.Equal(selectionId, standard.SelectionId);
        Assert.NotEqual(Guid.Empty, standard.Id);
        Assert.Equal(3, standard.SortOrder);

        var custom = ValuationComparableSelectionRequestRules.BuildAdjustmentLine(
            selectionId, Line(MarketAdjustmentFactorKeys.Custom, labelAr: "  عامل خاص  "), 0);
        Assert.Equal("عامل خاص", custom.LabelAr);

        var customBlank = ValuationComparableSelectionRequestRules.BuildAdjustmentLine(
            selectionId, Line(MarketAdjustmentFactorKeys.Custom, labelAr: " "), 0);
        Assert.Equal(MarketAdjustmentFactorKeys.DefaultLabelAr(MarketAdjustmentFactorKeys.Custom), customBlank.LabelAr);
    }

    [Fact]
    public void BuildAdjustmentLine_reuses_id_and_explicit_sort_order_and_trims_text()
    {
        var id = Guid.NewGuid();
        var line = ValuationComparableSelectionRequestRules.BuildAdjustmentLine(
            Guid.NewGuid(),
            new SaveValuationComparableAdjustmentLineRequest
            {
                Id = id,
                FactorKey = " financing ",
                Percent = -2.5m,
                Rationale = "  مبرر  ",
                DescriptionAr = "   ",
                IsIncluded = false,
                SortOrder = 7,
            },
            1);

        Assert.Equal(id, line.Id);
        Assert.Equal(MarketAdjustmentFactorKeys.Financing, line.FactorKey);
        Assert.Equal(-2.5m, line.Percent);
        Assert.Equal("مبرر", line.Rationale);
        Assert.Null(line.DescriptionAr);
        Assert.False(line.IsIncluded);
        Assert.Equal(7, line.SortOrder);
    }

    [Fact]
    public void ApplyMarketSave_rebuilds_lines_and_applies_overrides()
    {
        var row = new ValuationComparableSelection
        {
            Id = Guid.NewGuid(),
            AdjustmentLines = [new ValuationComparableAdjustmentLine { FactorKey = "market" }],
            WeightIsManual = true,
            WeightPct = 30m,
            WeightOverrideRationale = "old",
        };

        ValuationComparableSelectionRequestRules.ApplyMarketSave(row, new()
        {
            AdjustmentLines = [Line(MarketAdjustmentFactorKeys.Location, percent: 4m), Line(sortOrder: 9)],
            WeightIsManual = false,
            WeightPct = 55m,
            WeightOverrideRationale = "ignored",
            PriceOverrideSar = 1_000_000m,
            AreaOverrideSqm = 320m,
            AreaAdjustmentMethod = " AMTHAL ",
        });

        Assert.Equal(2, row.AdjustmentLines.Count);
        Assert.Equal([0, 9], row.AdjustmentLines.Select(l => l.SortOrder));
        Assert.All(row.AdjustmentLines, l => Assert.Equal(row.Id, l.SelectionId));
        Assert.False(row.WeightIsManual);
        Assert.Null(row.WeightPct);
        Assert.Null(row.WeightOverrideRationale);
        Assert.Equal(1_000_000m, row.PriceOverrideSar);
        Assert.Equal(320m, row.AreaOverrideSqm);
        Assert.Equal(AreaAdjustmentMethods.Amthal, row.AreaAdjustmentMethod);
    }

    [Fact]
    public void ApplyMarketSave_keeps_manual_weight_and_existing_method_when_not_sent()
    {
        var row = new ValuationComparableSelection { Id = Guid.NewGuid(), AreaAdjustmentMethod = AreaAdjustmentMethods.Amthal };

        ValuationComparableSelectionRequestRules.ApplyMarketSave(row, new()
        {
            WeightIsManual = true,
            WeightPct = 42m,
            WeightOverrideRationale = "  مبرر الوزن اليدوي  ",
        });

        Assert.True(row.WeightIsManual);
        Assert.Equal(42m, row.WeightPct);
        Assert.Equal("مبرر الوزن اليدوي", row.WeightOverrideRationale);
        Assert.Equal(AreaAdjustmentMethods.Amthal, row.AreaAdjustmentMethod);
        Assert.Empty(row.AdjustmentLines);
    }

    // ---- market-approach header ----

    [Fact]
    public void ValidateMarketApproach_rejects_negative_area_then_unknown_basis()
    {
        var area = ValuationComparableSelectionRequestRules.ValidateMarketApproach(
            new() { SubjectAreaSqm = -1m, AdjustmentBasis = "bogus" });
        Assert.NotNull(area);
        Assert.Equal("المساحة يجب أن تكون ≥ 0", area["subjectAreaSqm"]);
        Assert.Single(area);

        var basis = ValuationComparableSelectionRequestRules.ValidateMarketApproach(
            new() { SubjectAreaSqm = 10m, AdjustmentBasis = "bogus" });
        Assert.NotNull(basis);
        Assert.Equal("أساس التسويات غير معروف", basis["adjustmentBasis"]);

        Assert.Null(ValuationComparableSelectionRequestRules.ValidateMarketApproach(
            new() { SubjectAreaSqm = 10m, AdjustmentBasis = "whole_property" }));
        Assert.Null(ValuationComparableSelectionRequestRules.ValidateMarketApproach(new()));
    }

    [Fact]
    public void SeedMarketApproach_copies_org_values_when_in_range()
    {
        var header = ValuationComparableSelectionRequestRules.SeedMarketApproach(
            A,
            new OrganizationValuationSettingsDto
            {
                AreaFactorPct = 7m,
                AnnualMarketRatePct = 0m,
                MarketValueRoundDecimals = 6,
            });

        Assert.NotEqual(Guid.Empty, header.Id);
        Assert.Equal(A, header.ValuationRequestId);
        Assert.Equal(7m, header.AreaFactorPct);
        Assert.Equal(0m, header.AnnualMarketRatePct);
        Assert.Equal(6, header.ValueRoundDecimals);
    }

    [Fact]
    public void SeedMarketApproach_falls_back_to_methodology_defaults_when_out_of_range()
    {
        var header = ValuationComparableSelectionRequestRules.SeedMarketApproach(
            A,
            new OrganizationValuationSettingsDto
            {
                AreaFactorPct = 0m,
                AnnualMarketRatePct = -1m,
                MarketValueRoundDecimals = 7,
            });

        Assert.Equal(AreaAdjustmentRules.DefaultAreaFactorPct, header.AreaFactorPct);
        Assert.Equal(MarketApproachRules.DefaultAnnualMarketRatePct, header.AnnualMarketRatePct);
        Assert.Equal(MarketApproachRules.DefaultValueRoundDecimals, header.ValueRoundDecimals);
    }

    [Fact]
    public void ApplyMarketApproach_applies_in_range_overrides_and_keeps_out_of_range_values()
    {
        var header = new ValuationMarketApproach
        {
            AreaFactorPct = 5m,
            AnnualMarketRatePct = 4m,
            ValueRoundDecimals = 4,
            AnalysisNotes = "old",
            SubjectSpecJson = "{\"location\":\"x\"}",
        };

        ValuationComparableSelectionRequestRules.ApplyMarketApproach(header, new()
        {
            SubjectAreaSqm = 500m,
            AdjustmentBasis = " Whole_Property ",
            AreaFactorPct = 60m,
            AnnualMarketRatePct = 12m,
            ValueRoundDecimals = 9,
            AnalysisNotes = "  ",
            SubjectSpecs = null,
        });

        Assert.Equal(500m, header.SubjectAreaSqm);
        Assert.Equal(MarketAdjustmentBasisKeys.WholeProperty, header.AdjustmentBasis);
        Assert.Equal(5m, header.AreaFactorPct);
        Assert.Equal(12m, header.AnnualMarketRatePct);
        Assert.Equal(4, header.ValueRoundDecimals);
        Assert.Null(header.AnalysisNotes);
        Assert.Equal("{\"location\":\"x\"}", header.SubjectSpecJson);
    }

    [Fact]
    public void ApplyMarketApproach_trims_notes_and_serializes_subject_specs()
    {
        var header = new ValuationMarketApproach { AdjustmentBasis = MarketAdjustmentBasisKeys.WholeProperty };

        ValuationComparableSelectionRequestRules.ApplyMarketApproach(header, new()
        {
            AreaFactorPct = 0.1m,
            ValueRoundDecimals = 0,
            AnalysisNotes = "  ملاحظات  ",
            SubjectSpecs = new Dictionary<string, string> { ["location"] = " شمال " },
        });

        Assert.Equal(MarketAdjustmentBasisKeys.WholeProperty, header.AdjustmentBasis);
        Assert.Equal(0.1m, header.AreaFactorPct);
        Assert.Equal(0, header.ValueRoundDecimals);
        Assert.Equal("ملاحظات", header.AnalysisNotes);
        Assert.Equal(
            ValuationComparableListBuilder.SerializeSubjectSpecs(
                new Dictionary<string, string> { ["location"] = "شمال" }),
            header.SubjectSpecJson);
    }
}
