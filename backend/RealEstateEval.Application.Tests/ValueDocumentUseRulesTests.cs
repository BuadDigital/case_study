using RealEstateEval.Domain;
using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Application.Tests;

/// <summary>«مستند ذو قيمة»: the appraiser's use of a valued document and its effect on the final value.</summary>
public class ValueDocumentUseRulesTests
{
    private static readonly Guid DocA = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static readonly Guid DocB = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");

    private static readonly ValuedDocumentRef[] OnProperty =
    [
        new(DocA, "دراسة الدخل", "approved"),
        new(DocB, "تقرير تقييم الآلات", "pending"),
    ];

    [Fact]
    public void Indicator_cannot_use_an_approach_the_system_values_internally()
    {
        var errors = ValueDocumentUseRules.Validate(
            [new(DocA, "indicator", "market", "طريقة المقارنة", 1_000_000m)],
            [ValuationApproachKinds.Market],
            OnProperty);

        Assert.Contains("uses[0].approachKey", errors.Keys);
    }

    [Fact]
    public void Income_indicator_and_an_addition_are_accepted()
    {
        var errors = ValueDocumentUseRules.Validate(
            [
                new(DocA, "indicator", "income", "الطريقة المتبقية", 1_200_000m),
                new(DocB, "addition", null, null, 150_000m),
            ],
            [ValuationApproachKinds.Market, ValuationApproachKinds.Cost],
            OnProperty);

        Assert.Empty(errors);
    }

    [Fact]
    public void A_method_is_chosen_once_within_its_approach()
    {
        var errors = ValueDocumentUseRules.Validate(
            [
                new(DocA, "indicator", "income", "الطريقة المتبقية", 1_000_000m),
                new(DocB, "indicator", "income", " الطريقة  المتبقية ", 1_100_000m),
            ],
            [],
            OnProperty);

        Assert.Contains("uses[1].methodName", errors.Keys);
    }

    [Fact]
    public void Values_are_positive_and_documents_belong_to_the_property()
    {
        var errors = ValueDocumentUseRules.Validate(
            [
                new(DocA, "addition", null, null, 0m),
                new(Guid.NewGuid(), "addition", null, null, 10m),
                new(DocB, "maybe", null, null, 10m),
            ],
            [],
            OnProperty);

        Assert.Contains("uses[0].value", errors.Keys);
        Assert.Contains("uses[1].attachmentId", errors.Keys);
        Assert.Contains("uses[2].effect", errors.Keys);
    }

    [Fact]
    public void Additions_follow_the_discount_and_the_total_is_rounded_once()
    {
        // 1,234,567 × (1 − 20%) = 987,653.6 unrounded; + 12,345.4 = 999,999 → nearest 1,000 = 1,000,000.
        var (before, afterDiscount, final, applied) = ReconciliationRules.FinalTotal(
            1_234_567m,
            decimals: 3,
            BasisOfValueKeys.Liquidation,
            ValuePremiseKeys.Forced,
            discountPct: 20m,
            additionsTotal: 12_345.4m);

        Assert.True(applied);
        Assert.Equal(1_235_000m, before);
        Assert.Equal(987_653.6m, afterDiscount);
        Assert.Equal(1_000_000m, final);
    }

    [Fact]
    public void Without_additions_the_total_is_the_rounded_property_value()
    {
        var (_, _, final, _) = ReconciliationRules.FinalTotal(
            1_234_567m, 3, BasisOfValueKeys.Market, null, 0m, 0m);
        var (_, legacy, _) = ReconciliationRules.FinalOpinionWithOptionalDiscount(
            1_234_567m, 3, BasisOfValueKeys.Market, null, 0m);

        Assert.Equal(legacy, final);
    }

    [Fact]
    public void Document_indicators_start_with_equal_weights()
    {
        var doc = ValueDocumentUseRules.ReconciliationKind(DocA);
        var weights = ReconciliationRules.SuggestWeights(
            [ValuationApproachKinds.Market, ValuationApproachKinds.Cost, doc], 1_000_000m, 900_000m);

        Assert.Equal(33.33m, weights[ValuationApproachKinds.Market]);
        Assert.Equal(33.34m, weights[doc]);
        Assert.Equal(100m, weights.Values.Sum());
        Assert.StartsWith("doc:", doc);
        Assert.True(doc.Length <= 64);
    }

    [Fact]
    public void Issuance_needs_every_used_document_approved()
    {
        Assert.True(ValuationIssuanceGateRules.ValueDocuments([], []).Passed);
        var blocked = ValuationIssuanceGateRules.ValueDocuments(["تقرير تقييم الآلات"], []);
        Assert.False(blocked.Passed);
        Assert.True(blocked.IsHard);
        Assert.Contains("تقرير تقييم الآلات", blocked.DetailAr);
    }
}
