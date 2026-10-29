using RealEstateEval.Domain;
using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Application.Rules;
using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// Round 2: a cost line (quantity × unit cost) and the cost total stay within 1e12 — an overflow of
/// numeric(18,2) was a 500 — and the rationales the methodology requires are at least 10 characters
/// on the cost save.
/// </summary>
public class CostRequestRound2Tests
{
    [Fact]
    public void A_line_amount_beyond_a_trillion_is_refused_in_arabic()
    {
        var errors = ValuationCostApproachRequestRules.Validate(new SaveValuationCostApproachRequest
        {
            Lines = [Line(CostLineItemKeys.Custom, 9_000_000m, 900_000_000m)],
        });

        Assert.Contains("مبلغ البند (الكمية × تكلفة الوحدة) يتجاوز الحد المعقول", errors["lines[0].unitCostSar"]);
    }

    [Fact]
    public void The_cost_total_with_indirect_costs_beyond_a_trillion_is_refused()
    {
        // Two lines just under the ceiling each; together (and with indirect costs) above it.
        var errors = ValuationCostApproachRequestRules.Validate(new SaveValuationCostApproachRequest
        {
            Lines =
            [
                Line(CostLineItemKeys.Custom, 1_000_000m, 600_000m),
                Line(CostLineItemKeys.Custom, 1_000_000m, 600_000m),
            ],
        });
        Assert.Contains("إجمالي التكلفة", errors["lines"]);

        var withIndirect = ValuationCostApproachRequestRules.Validate(new SaveValuationCostApproachRequest
        {
            Lines = [Line(CostLineItemKeys.Custom, 1_000_000m, 900_000m)],
            IndirectItems = [new SaveValuationIndirectCostItemRequest { ItemKey = IndirectCostItemKeys.DeveloperProfit, Pct = 20m }],
        });
        Assert.Contains("إجمالي التكلفة", withIndirect["lines"]);

        Assert.Empty(ValuationCostApproachRequestRules.Validate(new SaveValuationCostApproachRequest
        {
            Lines = [Line(CostLineItemKeys.Custom, 220m, 2_000m)],
        }));
    }

    [Fact]
    public void A_repeated_floors_line_is_measured_from_the_first_floor_for_the_ceiling()
    {
        var errors = ValuationCostApproachRequestRules.Validate(new SaveValuationCostApproachRequest
        {
            Lines =
            [
                Line(CostLineItemKeys.FirstFloor, 5_000_000m, 200_000m),
                new SaveValuationCostLineRequest
                {
                    StructureKind = "floor", ItemKey = CostLineItemKeys.RepeatedFloors, Label = "الأدوار المتكررة",
                    AreaSqm = 0m, Unit = CostLineUnits.Sqm, UnitCostSar = 0m, RepeatedFloorCount = 100, IsIncluded = true,
                },
            ],
        });

        Assert.Contains("يتجاوز الحد المعقول", errors["lines[1].unitCostSar"]);
    }

    [Fact]
    public void Cost_rationales_the_alerts_ask_for_are_at_least_ten_characters()
    {
        var errors = ValuationCostApproachRequestRules.Validate(new SaveValuationCostApproachRequest
        {
            UseRestrictionDiscountPct = 10m,
            UseRestrictionRationale = "قيد",
            FunctionalObsolescencePct = 5m,
            FunctionalObsolescenceRationale = "تصميم",
            ExternalObsolescencePct = 0m,
            ExternalObsolescenceRationale = "لا",
        });

        Assert.Equal("مبرر خصم تقييد الاستخدام يجب ألا يقل عن 10 أحرف", errors["useRestrictionRationale"]);
        Assert.Equal("مبرر التقادم الوظيفي يجب ألا يقل عن 10 أحرف", errors["functionalObsolescenceRationale"]);
        // Not required at 0٪ — short free text is left alone; blank stays a draft for the alert to catch.
        Assert.False(errors.ContainsKey("externalObsolescenceRationale"));
        Assert.Empty(ValuationCostApproachRequestRules.Validate(new SaveValuationCostApproachRequest
        {
            UseRestrictionDiscountPct = 10m,
            UseRestrictionRationale = "",
        }));
    }

    private static SaveValuationCostLineRequest Line(string itemKey, decimal quantity, decimal unitCost) => new()
    {
        StructureKind = "floor",
        ItemKey = itemKey,
        Label = "بند",
        AreaSqm = quantity,
        Unit = CostLineUnits.Sqm,
        UnitCostSar = unitCost,
        IsIncluded = true,
    };
}
