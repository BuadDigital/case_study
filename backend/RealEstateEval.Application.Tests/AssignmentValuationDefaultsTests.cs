using RealEstateEval.Domain;
using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Application.Tests;

public class AssignmentValuationDefaultsTests
{
    [Theory]
    [InlineData(AssignmentType.Execution, "auction_liquidation", "البيع بالمزاد العلني لغرض التصفية")]
    [InlineData(AssignmentType.Estates, "auction_liquidation", "البيع بالمزاد العلني لغرض التصفية")]
    [InlineData(AssignmentType.PrivateSector, "sale", "البيع")]
    public void Purpose_follows_assignment_primary(
        AssignmentType type,
        string key,
        string label)
    {
        Assert.Equal(key, AssignmentValuationDefaults.PurposeKey(type));
        Assert.Equal(label, AssignmentValuationDefaults.PurposeLabelAr(type));
    }

    [Theory]
    [InlineData(AssignmentType.Execution, "liquidation", "قيمة التصفية")]
    [InlineData(AssignmentType.Estates, "liquidation", "قيمة التصفية")]
    [InlineData(AssignmentType.PrivateSector, "market", "القيمة السوقية")]
    public void Basis_follows_assignment_primary(
        AssignmentType type,
        string key,
        string label)
    {
        Assert.Equal(key, AssignmentValuationDefaults.BasisOfValueKey(type));
        Assert.Equal(label, AssignmentValuationDefaults.BasisOfValueLabelAr(type));
    }

    [Theory]
    [InlineData(AssignmentType.Execution, "orderly", "التصفية المنظمة")]
    [InlineData(AssignmentType.Estates, "orderly", "التصفية المنظمة")]
    [InlineData(AssignmentType.PrivateSector, "current", "الاستخدام الحالي")]
    public void Premise_follows_basis_of_assignment(
        AssignmentType type,
        string key,
        string label)
    {
        Assert.Equal(key, AssignmentValuationDefaults.PremiseKey(type));
        Assert.Equal(label, AssignmentValuationDefaults.PremiseLabelAr(type));
    }

    // ---- one owner of the basis (ruling 2026-11-10) ----

    [Fact]
    public void The_work_order_basis_and_premise_win_over_the_appraisers_saved_choice()
    {
        var (basis, premise) = AssignmentValuationDefaults.ResolveBasisAndPremise(
            AssignmentType.Execution, "market", "hau", "liquidation", "forced");

        Assert.Equal(BasisOfValueKeys.Market, basis);
        Assert.Equal(ValuePremiseKeys.HighestAndBest, premise);
    }

    [Fact]
    public void The_saved_basis_counts_only_when_the_work_order_has_none()
    {
        var (basis, premise) = AssignmentValuationDefaults.ResolveBasisAndPremise(
            AssignmentType.PrivateSector, "  ", null, "Liquidation", "forced");

        Assert.Equal(BasisOfValueKeys.Liquidation, basis);
        Assert.Equal(ValuePremiseKeys.Forced, premise);
    }

    [Theory]
    [InlineData(AssignmentType.Execution, "liquidation", "orderly")]
    [InlineData(AssignmentType.PrivateSector, "market", "current")]
    public void Nothing_saved_falls_back_to_the_assignment_default(AssignmentType type, string basisKey, string premiseKey)
    {
        var (basis, premise) = AssignmentValuationDefaults.ResolveBasisAndPremise(type, null, null);

        Assert.Equal(basisKey, basis);
        Assert.Equal(premiseKey, premise);
    }

    [Fact]
    public void A_blank_or_incompatible_premise_takes_the_default_of_the_resolved_basis()
    {
        // The work order says liquidation without a premise: orderly — never the old «forced» guess.
        Assert.Equal(
            ValuePremiseKeys.Orderly,
            AssignmentValuationDefaults.ResolveBasisAndPremise(AssignmentType.PrivateSector, "liquidation", null).PremiseKey);
        // A saved liquidation premise does not ride along with a work-order market basis.
        Assert.Equal(
            ValuePremiseKeys.CurrentUse,
            AssignmentValuationDefaults.ResolveBasisAndPremise(AssignmentType.Execution, "market", null, null, "forced").PremiseKey);
        // An unknown work-order key is skipped.
        Assert.Equal(
            BasisOfValueKeys.Liquidation,
            AssignmentValuationDefaults.ResolveBasisAndPremise(AssignmentType.Execution, "xyz", null).BasisKey);
    }

    [Fact]
    public void Purpose_is_the_work_orders_then_the_assignment_default_then_the_settings()
    {
        Assert.Equal(
            ValuationPurposeKeys.EstateLiquidation,
            AssignmentValuationDefaults.ResolvePurposeKey(AssignmentType.Execution, "estate_liquidation", "sale"));
        Assert.Equal(
            ValuationPurposeKeys.AuctionLiquidation,
            AssignmentValuationDefaults.ResolvePurposeKey(AssignmentType.Execution, null, "sale"));
        Assert.Equal(
            ValuationPurposeKeys.Sale,
            AssignmentValuationDefaults.ResolvePurposeKey(null, " ", "sale"));
        Assert.Null(AssignmentValuationDefaults.ResolvePurposeKey(null, null, null));
    }
}
