using RealEstateEval.Application.Contracts;
using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Application.Rules;
using RealEstateEval.Valuation.Application.Services;
using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// On the server-side field payload: basis / premise print the reconciliation's keys (the
/// appraiser's saved choice), and the liquidation discount prints only when basis = liquidation and
/// it is above zero.
/// </summary>
public class ValuationReportFieldInjectionBasisTests
{
    private static Dictionary<string, string?> Bag(ValuationReconciliationDto recon) =>
        ValuationReportFieldInjectionService.BuildValueBag(
            ValuationRequest.Create(Guid.NewGuid(), "VR-D1", Guid.NewGuid(), "الرياض", "فيلا", "مقيم", "2026-10-25", DateTime.UtcNow),
            prop: null,
            workspace: null,
            inspector: new InspectorPayloadFacts(),
            client: null,
            org: new OrganizationSettingsDto(),
            market: null,
            cost: null,
            recon: recon,
            printable: [],
            hasStructures: false,
            deedNatureMatchOutcome: "",
            today: new DateOnly(2026, 10, 25));

    [Fact]
    public void A_saved_market_basis_prints_market_and_no_discount_even_with_a_stored_discount()
    {
        var bag = Bag(new ValuationReconciliationDto
        {
            BasisOfValueKey = BasisOfValueKeys.Market,
            ValuePremiseKey = ValuePremiseKeys.CurrentUse,
            LiquidationDiscountPct = 20m,
            LiquidationDiscountApplied = false,
            FinalOpinionValue = 1_000_000m,
        });

        Assert.Equal(BasisOfValueKeys.LabelAr(BasisOfValueKeys.Market), bag["basis_of_value_ar"]);
        Assert.Equal(ValuePremiseKeys.LabelAr(ValuePremiseKeys.CurrentUse), bag["value_premise_ar"]);
        Assert.False(bag.ContainsKey("final.liquidation_discount_pct"));
    }

    [Fact]
    public void A_saved_liquidation_basis_prints_the_compound_name_and_the_applied_discount()
    {
        var bag = Bag(new ValuationReconciliationDto
        {
            BasisOfValueKey = BasisOfValueKeys.Liquidation,
            ValuePremiseKey = ValuePremiseKeys.Forced,
            LiquidationDiscountPct = 15m,
            LiquidationDiscountApplied = true,
            FinalOpinionValue = 850_000m,
        });

        Assert.Equal("البيع القسري", bag["basis_of_value_ar"]);
        Assert.Equal(ValuePremiseKeys.LabelAr(ValuePremiseKeys.Forced), bag["value_premise_ar"]);
        Assert.NotNull(bag["final.liquidation_discount_pct"]);
    }

    [Fact]
    public void The_document_final_value_section_prints_the_saved_basis_over_the_work_order_default()
    {
        // A non-private work order defaults to liquidation; the appraiser saved market value.
        var fields = ValuationReportFieldBuilder.BuildFields(
            ValuationReportSectionKeys.FinalValue,
            ValuationRequest.Create(Guid.NewGuid(), "VR-D1", Guid.NewGuid(), "الرياض", "فيلا", "مقيم", "2026-10-25", DateTime.UtcNow),
            prop: null,
            workspace: null,
            org: new OrganizationSettingsDto(),
            market: null,
            cost: null,
            recon: new ValuationReconciliationDto
            {
                BasisOfValueKey = BasisOfValueKeys.Market,
                BasisOfValueLabelAr = BasisOfValueKeys.LabelAr(BasisOfValueKeys.Market),
                ValuePremiseKey = ValuePremiseKeys.CurrentUse,
                ValuePremiseLabelAr = ValuePremiseKeys.LabelAr(ValuePremiseKeys.CurrentUse),
                LiquidationDiscountPct = 20m,
                LiquidationDiscountApplied = false,
            },
            hasStructures: false,
            marketUsed: true,
            costUsed: false,
            assignmentType: RealEstateEval.Domain.AssignmentType.Execution);

        Assert.Equal(BasisOfValueKeys.LabelAr(BasisOfValueKeys.Market), fields["basis"]);
        Assert.Equal(ValuePremiseKeys.LabelAr(ValuePremiseKeys.CurrentUse), fields["premise"]);
        Assert.Null(fields["discountPct"]);
    }
}
