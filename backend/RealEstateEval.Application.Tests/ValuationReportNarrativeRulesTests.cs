using RealEstateEval.Domain;
using RealEstateEval.Valuation.Domain;

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
 // Specialist clause: default is the standard denial.
        Assert.Contains("لم يستعن المقيّم بأي أخصائي خارجي", text);
    }

    [Fact]
    public void Special_assumptions_specialist_details_replace_the_denial()
    {
        var text = ValuationReportNarrativeRules.SpecialAssumptionsBody(
            hasStructures: true,
            deedKindLabelAr: null,
            basisLabelAr: null,
            premiseLabelAr: null,
            restrictionsLine: null,
            inspectionReservationLine: null,
            externalSpecialistUsed: true,
            externalSpecialistDetails: "خبير إنشائي — تقدير العمر الاقتصادي");

        Assert.Contains("خبير إنشائي", text);
        Assert.Contains("تقريره مرفق", text);
        Assert.DoesNotContain("لم يستعن المقيّم", text);
    }

    [Fact]
    public void Special_assumptions_drop_library_denial_when_specialist_used()
    {
        var libraryDenial =
            "لم يستعن المقيّم بأي أخصائي أو مؤسسة خدمات أثناء تنفيذ مهمة التقييم، وجميع الإجراءات والتحليلات اللازمة نُفّذت بواسطة فريق العمل بإدارة التقييم.";
        var text = ValuationReportNarrativeRules.SpecialAssumptionsBody(
            hasStructures: true,
            deedKindLabelAr: null,
            basisLabelAr: null,
            premiseLabelAr: null,
            restrictionsLine: null,
            inspectionReservationLine: null,
            externalSpecialistUsed: true,
            externalSpecialistDetails: "خبير إنشائي — تقدير العمر الاقتصادي",
            selectedAssumptions: [libraryDenial, "تم افتراض بأن قطعة الأرض ليست زائدة تنظيمية."]);

        Assert.Contains("خبير إنشائي", text);
        Assert.Contains("زائدة تنظيمية", text);
        Assert.DoesNotContain("لم يستعن المقيّم", text);
        Assert.DoesNotContain("مؤسسة خدمات", text);
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
