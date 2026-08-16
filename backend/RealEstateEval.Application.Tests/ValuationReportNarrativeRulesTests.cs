using RealEstateEval.Domain;

namespace RealEstateEval.Application.Tests;

public class ValuationReportNarrativeRulesTests
{
    [Fact]
    public void Research_scope_lists_sources()
    {
        var text = ValuationReportNarrativeRules.ResearchScopeBody(
            ["منصة عقار", "ميداني"],
            adoptedCount: 2);

        Assert.Contains("2", text);
        Assert.Contains("منصة عقار", text);
        Assert.Contains("ميداني", text);
    }

    [Fact]
    public void Special_assumptions_include_basis_and_vacant_land()
    {
        var text = ValuationReportNarrativeRules.SpecialAssumptionsBody(
            hasStructures: false,
            deedKindLabelAr: "تقليدي",
            basisLabelAr: "قيمة التصفية",
            premiseLabelAr: "تصفية منظمة",
            restrictionsLine: null);

        Assert.Contains("أرض فضاء", text);
        Assert.Contains("قيمة التصفية", text);
        Assert.Contains("تصفية منظمة", text);
        Assert.Contains("ESG", text);
    }

    [Fact]
    public void Comparables_map_lists_points()
    {
        var text = ValuationReportNarrativeRules.ComparablesMapBody(
            "21.5",
            "39.1",
            [(1, "أرض سكنية", "21.6", "39.2")]);

        Assert.Contains("21.5", text);
        Assert.Contains("#1", text);
        Assert.Contains("أرض سكنية", text);
    }
}
