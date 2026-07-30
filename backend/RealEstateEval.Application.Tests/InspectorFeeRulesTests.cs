using System.Reflection;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;

namespace RealEstateEval.Application.Tests;

public class InspectorFeeRulesTests
{
    [Theory]
    [InlineData("fi-ahmed", "متعاون فرد")]
    [InlineData("fi-abdullah-abdulmane", "موظف")]
    [InlineData(null, "موظف")]
    public void Resolves_inspector_type(string? assigneeId, string expectedType)
    {
        Assert.Equal(expectedType, InspectorFeeRules.ResolveInspectorType(assigneeId));
    }

    [Fact]
    public void Engineering_office_party_type_is_always_external()
    {
        Assert.Equal(
            InspectorFeeRules.TypeCooperatorOrganization,
            EngineeringSurveyFeeRules.OfficePartyType);
    }

    [Theory]
    [InlineData(100, 300)]
    [InlineData(500, 300)]
    [InlineData(501, 450)]
    [InlineData(1000, 450)]
    [InlineData(1001, 900)]
    [InlineData(1500, 900)]
    [InlineData(1501, 1500)]
    [InlineData(10000, 1500)]
    [InlineData(10001, 4000)]
    public void Engineering_survey_area_tiers(decimal areaM2, decimal expectedFee)
    {
        var fee = EngineeringSurveyFeeRules.ResolveFeeFromTiers(
            areaM2,
            [
                new(500m, 300m),
                new(1000m, 450m),
                new(1500m, 900m),
                new(10000m, 1500m),
                new(null, 4000m),
            ]);
        Assert.Equal(expectedFee, fee);
    }

    [Fact]
    public void Normalizes_non_increasing_tier_maxes()
    {
        var tiers = EngineeringSurveyFeeRules.NormalizeTiers(
        [
            new(800m, 100m),
            new(500m, 200m),
            new(500m, 300m),
            new(2000m, 400m),
            new(null, 500m),
        ]);
        Assert.Equal(5, tiers.Count);
        Assert.Equal(800m, tiers[0].MaxAreaM2);
        Assert.Equal(801m, tiers[1].MaxAreaM2);
        Assert.Equal(802m, tiers[2].MaxAreaM2);
        Assert.Equal(2000m, tiers[3].MaxAreaM2);
        Assert.Null(tiers[4].MaxAreaM2);
    }

    [Fact]
    public void Supports_two_tier_schedule()
    {
        var fee = EngineeringSurveyFeeRules.ResolveFeeFromTiers(
            1200m,
            [
                new(1000m, 200m),
                new(null, 900m),
            ]);
        Assert.Equal(900m, fee);
    }

    /// <summary>
    /// The old behaviour replaced an empty schedule with a built-in ladder, so a table nobody had
    /// filled in still produced invoiceable amounts. Emptiness must now be unanswerable.
    /// </summary>
    [Fact]
    public void An_empty_schedule_resolves_to_no_fee_at_all()
    {
        Assert.Null(EngineeringSurveyFeeRules.ResolveFeeFromTiers(750m, []));
        Assert.False(EngineeringSurveyFeeRules.HasTiers([]));
        Assert.False(EngineeringSurveyFeeRules.HasTiers(null));
    }

    /// <summary>
    /// The pricing screen scaffolds a new schedule with zero amounts, so a table can be saved with
    /// tiers that carry no rate. Zero there means "nobody filled this in", not "this band is free".
    /// </summary>
    [Fact]
    public void A_tier_left_at_zero_counts_as_unpriced()
    {
        Assert.Null(EngineeringSurveyFeeRules.ResolveFeeFromTiers(
            300m,
            [new(500m, 0m), new(null, 0m)]));

        // A priced band still answers even when a neighbouring band is blank.
        Assert.Equal(900m, EngineeringSurveyFeeRules.ResolveFeeFromTiers(
            900m,
            [new(500m, 0m), new(null, 900m)]));
    }

    [Fact]
    public void Normalising_an_empty_schedule_is_rejected_rather_than_seeded()
    {
        Assert.Throws<ArgumentException>(() => EngineeringSurveyFeeRules.NormalizeTiers([]));
    }

    [Theory]
    [InlineData("1200", true, 1200)]
    [InlineData("1,250.5", true, 1250.5)]
    [InlineData("", false, 0)]
    [InlineData("0", false, 0)]
    public void Parses_property_area(string raw, bool ok, decimal expected)
    {
        var parsed = EngineeringSurveyFeeRules.TryParseAreaM2(raw, out var area);
        Assert.Equal(ok, parsed);
        if (ok) Assert.Equal(expected, area);
    }

    [Fact]
    public void Government_review_is_always_an_individual_cooperator()
    {
        Assert.Equal(InspectorFeeRules.TypeCooperatorIndividual, GovernmentReviewFeeRules.PartyType);
    }

    /// <summary>
    /// The rates that used to live in code — 350 for a visit, 400/500 for a cooperator, and the
    /// 300…4000 tier ladder — are gone by decision ق٨. Reflection is the only way to keep them from
    /// creeping back as a "temporary" constant.
    /// </summary>
    [Theory]
    [InlineData(typeof(GovernmentReviewFeeRules))]
    [InlineData(typeof(InspectorFeeRules))]
    [InlineData(typeof(EngineeringSurveyFeeRules))]
    public void Fee_rules_hold_no_hard_coded_amounts(Type rulesType)
    {
        var amounts = rulesType
            .GetFields(BindingFlags.Public | BindingFlags.Static)
            .Where(f => f.IsLiteral && f.FieldType == typeof(decimal))
            .Select(f => f.Name)
            .ToList();

        Assert.Empty(amounts);
    }

    [Fact]
    public void Classification_helpers_cover_every_cooperator_label()
    {
        Assert.True(InspectorFeeRules.IsCooperator("متعاون"));
        Assert.True(InspectorFeeRules.IsCooperator("متعاون فرد"));
        Assert.True(InspectorFeeRules.IsCooperator("متعاون شركة"));
        Assert.False(InspectorFeeRules.IsEmployee("متعاون فرد"));
        Assert.False(InspectorFeeRules.HasBillableAgreedFee(0m));
        Assert.True(InspectorFeeRules.HasBillableAgreedFee(1m));
    }

    [Fact]
    public void Net_fee_never_goes_negative()
    {
        Assert.Equal(350m, InspectorFeeRules.NetFee(400m, 50m));
        Assert.Equal(0m, InspectorFeeRules.NetFee(100m, 200m));
        Assert.Equal(350m, EngineeringSurveyFeeRules.NetFee(500m, 150m));
    }

    [Fact]
    public void Office_discount_transitions_match_billing_doc()
    {
        Assert.True(InspectorFeeBillingRules.TryResolveTransition(
            InspectorFeeBillingStatus.OfficeReview,
            InspectorFeeActions.OfficeApproveDiscount,
            out var approved,
            out _,
            out _));
        Assert.Equal(InspectorFeeBillingStatus.AtFinance, approved);

        Assert.True(InspectorFeeBillingRules.TryResolveTransition(
            InspectorFeeBillingStatus.OfficeReview,
            InspectorFeeActions.OfficeDispute,
            out var disputed,
            out _,
            out _));
        Assert.Equal(InspectorFeeBillingStatus.Disputed, disputed);

        Assert.True(InspectorFeeBillingRules.TryResolveTransition(
            InspectorFeeBillingStatus.Disputed,
            InspectorFeeActions.ResolveDispute,
            out var resolved,
            out _,
            out _));
        Assert.Equal(InspectorFeeBillingStatus.AtFinance, resolved);

        Assert.Equal("بانتظار موافقة المكتب", InspectorFeeBillingRules.StatusLabel(InspectorFeeBillingStatus.OfficeReview));
        Assert.Equal("خلاف تسعير", InspectorFeeBillingRules.StatusLabel(InspectorFeeBillingStatus.Disputed));
        Assert.Equal("جاهز للفوترة", InspectorFeeBillingRules.StatusLabel(InspectorFeeBillingStatus.AtFinance));
    }
}
