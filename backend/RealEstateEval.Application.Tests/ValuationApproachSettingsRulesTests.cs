using RealEstateEval.Domain;
using Xunit;
using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Application.Tests;

public class ValuationApproachSettingsRulesTests
{
    [Theory]
    [InlineData("أرض", true)]
    [InlineData("أرض سكنية", true)]
    [InlineData("land", true)]
    [InlineData("فيلا", false)]
    [InlineData("شقة", false)]
    [InlineData("عمارة", false)]
    [InlineData("", false)]
    [InlineData(null, false)]
    public void IsLandPropertyType_detects_land(string? propertyType, bool expected)
    {
        Assert.Equal(expected, ValuationApproachSettingsRules.IsLandPropertyType(propertyType));
    }

    [Fact]
    public void Cost_approach_allowed_for_land_with_structures_only()
    {
 // Q-3 amended (v2 spec §3): fenced land = structures ⟵ cost opens for those lines.
        Assert.False(ValuationApproachSettingsRules.CanEnableCostApproach("أرض", false));
        Assert.True(ValuationApproachSettingsRules.CanEnableCostApproach("أرض", true));
        Assert.True(ValuationApproachSettingsRules.CanEnableCostApproach("فيلا", false));

        var walledLand = ValuationApproachSettingsRules.Defaults(
            Guid.NewGuid(), "أرض سكنية", hasStructuresToValue: true);
        Assert.True(walledLand.CostApproachEnabled);

        var errors = ValuationApproachSettingsRules.Validate(
            true, true, false, null, null, "أرض",
            hasStructuresToValue: true,
            valuationPurposeKey: ValuationPurposeKeys.JudicialExecution);
        Assert.Empty(errors);
    }

    [Fact]
    public void Purpose_is_mandatory_and_other_needs_a_note()
    {
 // §4j-5: purpose is chosen by the valuer — not derived from assignment type.
        var missing = ValuationApproachSettingsRules.Validate(
            true, true, false, null, null, "فيلا");
        Assert.Contains("valuationPurposeKey", missing.Keys);

        var unknown = ValuationApproachSettingsRules.Validate(
            true, true, false, null, null, "فيلا", valuationPurposeKey: "xxx");
        Assert.Contains("valuationPurposeKey", unknown.Keys);

        var otherNoNote = ValuationApproachSettingsRules.Validate(
            true, true, false, null, null, "فيلا",
            valuationPurposeKey: ValuationPurposeKeys.Other);
        Assert.Contains("valuationPurposeNote", otherNoNote.Keys);

        var ok = ValuationApproachSettingsRules.Validate(
            true, true, false, null, null, "فيلا",
            valuationPurposeKey: ValuationPurposeKeys.Other,
            valuationPurposeNote: "تقييم لأغراض الزكاة");
        Assert.Empty(ok);
    }

    [Fact]
    public void Retrospective_valuation_date_needs_date()
    {
 // Omar decision 2026-08-17: two kinds — value issuance (automatic) or manual retrospective.
        var missing = ValuationApproachSettingsRules.Validate(
            true, true, false, null, null, "فيلا",
            valuationPurposeKey: ValuationPurposeKeys.JudicialExecution,
            valuationDateMode: ValuationDateModes.Retrospective);
        Assert.Contains("retrospectiveDate", missing.Keys);
        Assert.DoesNotContain("retrospectiveRationale", missing.Keys);

        var ok = ValuationApproachSettingsRules.Validate(
            true, true, false, null, null, "فيلا",
            valuationPurposeKey: ValuationPurposeKeys.JudicialExecution,
            valuationDateMode: ValuationDateModes.Retrospective,
            retrospectiveDate: new DateOnly(2026, 6, 1));
        Assert.Empty(ok);

        var badRange = ValuationApproachSettingsRules.Validate(
            true, true, false, null, null, "فيلا",
            valuationPurposeKey: ValuationPurposeKeys.JudicialExecution,
            valuationDateMode: ValuationDateModes.Retrospective,
            retrospectiveDate: new DateOnly(2026, 6, 10),
            retrospectiveDateEnd: new DateOnly(2026, 6, 1));
        Assert.Contains("retrospectiveDateEnd", badRange.Keys);

        var okRange = ValuationApproachSettingsRules.Validate(
            true, true, false, null, null, "فيلا",
            valuationPurposeKey: ValuationPurposeKeys.JudicialExecution,
            valuationDateMode: ValuationDateModes.Retrospective,
            retrospectiveDate: new DateOnly(2026, 6, 1),
            retrospectiveDateEnd: new DateOnly(2026, 6, 10));
        Assert.Empty(okRange);

 // "Value issuance" mode requires nothing.
        var issue = ValuationApproachSettingsRules.Validate(
            true, true, false, null, null, "فيلا",
            valuationPurposeKey: ValuationPurposeKeys.JudicialExecution);
        Assert.Empty(issue);
    }

    [Fact]
    public void Assumptions_json_round_trips_frozen_texts()
    {
        var json = ValuationApproachSettingsRules.SerializeAssumptions(
            ["افتراض أول", " ", "افتراض أول", "بند حر"]);
        var parsed = ValuationApproachSettingsRules.ParseAssumptions(json);
        Assert.Equal(2, parsed.Count);
        Assert.Null(ValuationApproachSettingsRules.SerializeAssumptions([]));
        Assert.Empty(ValuationApproachSettingsRules.ParseAssumptions("garbage"));
    }

    [Fact]
    public void External_specialist_yes_requires_details()
    {
 // External specialist clause (IVS 101) — not the assignment specialist nor the case-study specialist.
        var noDetails = ValuationApproachSettingsRules.Validate(
            true, true, false, null, null, "فيلا",
            valuationPurposeKey: ValuationPurposeKeys.Financing,
            externalSpecialistUsed: true);
        Assert.Contains("externalSpecialistDetails", noDetails.Keys);

        var ok = ValuationApproachSettingsRules.Validate(
            true, true, false, null, null, "فيلا",
            valuationPurposeKey: ValuationPurposeKeys.Financing,
            externalSpecialistUsed: true,
            externalSpecialistDetails: "خبير إنشائي — تقدير العمر الاقتصادي");
        Assert.Empty(ok);
    }

    [Fact]
    public void No_specialist_library_clause_is_detected()
    {
        Assert.True(ValuationApproachSettingsRules.IsNoExternalSpecialistAssumption(
            "لم يستعن المقيّم بأي أخصائي أو مؤسسة خدمات أثناء تنفيذ مهمة التقييم، وجميع الإجراءات والتحليلات اللازمة نُفّذت بواسطة فريق العمل بإدارة التقييم."));
        Assert.True(ValuationApproachSettingsRules.IsNoExternalSpecialistAssumption(
            "لم يستعن المقيّم بأي أخصائي خارجي"));
        Assert.False(ValuationApproachSettingsRules.IsNoExternalSpecialistAssumption(
            "تم افتراض بأن قطعة الأرض ليست زائدة تنظيمية."));

        var kept = ValuationApproachSettingsRules.WithoutNoExternalSpecialistAssumptions(
        [
            "بند ESG",
            "لم يستعن المقيّم بأي أخصائي خارجي في أداء مهمة التقييم هذه.",
            "تم افتراض عدم وجود نزع على قطعة الأرض في تاريخ التقييم.",
        ]);
        Assert.Equal(new[] { "بند ESG", "تم افتراض عدم وجود نزع على قطعة الأرض في تاريخ التقييم." }, kept);
    }

    [Fact]
    public void Defaults_disable_cost_for_land_only()
    {
        var land = ValuationApproachSettingsRules.Defaults(Guid.NewGuid(), "أرض تجارية");
        Assert.True(land.MarketApproachEnabled);
        Assert.False(land.CostApproachEnabled);
        Assert.False(land.IncomeApproachEnabled);

        var villa = ValuationApproachSettingsRules.Defaults(Guid.NewGuid(), "فيلا");
        Assert.True(villa.MarketApproachEnabled);
        Assert.True(villa.CostApproachEnabled);
        Assert.Equal(CostBasisKeys.Replacement, villa.CostBasisKey);
        Assert.Equal(CostMeasurementUnitKeys.ComparisonUnit, villa.CostMeasurementUnitKey);
        Assert.True(villa.AdjustmentsEditUnlocked);
    }

    [Fact]
    public void Validate_rejects_cost_for_land()
    {
        var errors = ValuationApproachSettingsRules.Validate(
            marketEnabled: true,
            costEnabled: true,
            incomeEnabled: false,
            costBasisKey: CostBasisKeys.Replacement,
            costMeasurementUnitKey: CostMeasurementUnitKeys.ComparisonUnit,
            propertyType: "أرض");
        Assert.Contains("costApproachEnabled", errors.Keys);
    }

    [Fact]
    public void Validate_rejects_income_and_requires_one_approach()
    {
        var none = ValuationApproachSettingsRules.Validate(
            false, false, false, null, null, "فيلا");
        Assert.Contains("appliedApproaches", none.Keys);

        var income = ValuationApproachSettingsRules.Validate(
            true, false, true, null, null, "فيلا");
        Assert.Contains("incomeApproachEnabled", income.Keys);
    }

    [Fact]
    public void Validate_rejects_unknown_cost_keys_only_when_cost_enabled()
    {
        var bad = ValuationApproachSettingsRules.Validate(
            true, true, false, "xxx", "yyy", "فيلا");
        Assert.Contains("costBasisKey", bad.Keys);
        Assert.Contains("costMeasurementUnitKey", bad.Keys);

        var costOff = ValuationApproachSettingsRules.Validate(
            true, false, false, "xxx", "yyy", "فيلا",
            valuationPurposeKey: ValuationPurposeKeys.SalePurchase);
        Assert.Empty(costOff);
    }

    [Fact]
    public void EnabledReconciliationKinds_follows_flags()
    {
        Assert.Equal(
            [ValuationApproachKinds.Market, ValuationApproachKinds.Cost],
            ValuationApproachSettingsRules.EnabledReconciliationKinds(true, true));
        Assert.Equal(
            [ValuationApproachKinds.Market],
            ValuationApproachSettingsRules.EnabledReconciliationKinds(true, false));
        Assert.Equal(
            [ValuationApproachKinds.Cost],
            ValuationApproachSettingsRules.EnabledReconciliationKinds(false, true));
        Assert.Empty(ValuationApproachSettingsRules.EnabledReconciliationKinds(false, false));
    }

    [Fact]
    public void CostBasis_and_unit_keys_normalize_and_label()
    {
        Assert.Equal("الإحلال", CostBasisKeys.LabelAr("replacement"));
        Assert.Equal("إعادة الإنتاج", CostBasisKeys.LabelAr("REPRODUCTION"));
        Assert.Equal(CostBasisKeys.Replacement, CostBasisKeys.Normalize("unknown"));

        Assert.Equal("المسح الكمي", CostMeasurementUnitKeys.LabelAr("quantity_survey"));
        Assert.Equal(
            CostMeasurementUnitKeys.ComparisonUnit,
            CostMeasurementUnitKeys.Normalize("bogus"));
    }

    [Fact]
    public void Som_price_description_is_known_with_label()
    {
        Assert.True(ComparablePriceDescriptions.IsKnown("som"));
        Assert.Equal("سوم", ComparablePriceDescriptions.LabelAr("som"));
    }
}
