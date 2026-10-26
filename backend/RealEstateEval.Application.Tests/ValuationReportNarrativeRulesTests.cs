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

    private const string FullOwnershipAssumption =
        "يفترض أن العقار مطلق الملكية وليس عليه أي نزاعات ملكية أو ورثة";

    [Theory]
    [InlineData("freehold", "أن العقار مطلق الملكية")]
    [InlineData("usufruct", "أن حق المنفعة محل التقييم قائم وساري المفعول طوال مدته المتبقية")]
    [InlineData("leased_land", "أن عقد إيجار الأرض المقامة عليها المباني قائم وساري المفعول")]
    public void The_full_ownership_assumption_follows_the_interest_valued(string interest, string expected)
    {
        var text = ValuationReportNarrativeRules.SpecialAssumptionsBody(
            hasStructures: true,
            deedKindLabelAr: null,
            basisLabelAr: null,
            premiseLabelAr: null,
            restrictionsLine: null,
            selectedAssumptions: [FullOwnershipAssumption],
            ownershipInterestKey: interest);

        Assert.Contains(expected, text);
        if (interest != "freehold") Assert.DoesNotContain("مطلق الملكية", text);
    }

    [Theory]
    [InlineData(1, "سنة واحدة")]
    [InlineData(2, "سنتان")]
    [InlineData(4, "4 سنوات")]
    [InlineData(10, "10 سنوات")]
    [InlineData(22, "22 سنة")]
    [InlineData(2.5, "2.5 سنة")]
    public void Years_print_in_correct_arabic(double years, string expected) =>
        Assert.Equal(expected, ValuationReportDisplayRules.FormatYears((decimal)years));

    [Fact]
    public void The_ownership_cell_follows_the_interest_key()
    {
        Assert.Equal("ملكية تامة", OwnershipInterestKeys.ReportCell("freehold", null, "ملكية تامة"));
        Assert.Equal("مشاع", OwnershipInterestKeys.ReportCell(null, 5m, "مشاع"));
        Assert.Equal("حق منفعة — المدة المتبقية 4 سنوات", OwnershipInterestKeys.ReportCell("usufruct", 4m, "ملكية تامة"));
        Assert.Equal("أرض مستأجرة — المدة المتبقية سنتان", OwnershipInterestKeys.ReportCell("leased_land", 2m, null));
        Assert.Equal("أرض مستأجرة", OwnershipInterestKeys.ReportCell("leased_land", null, null));
        Assert.Equal("ملكية تامة", RealEstateEval.CaseStudy.Domain.OwnershipTypes.LabelAr("absolute"));
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

        Assert.Contains("خبير إنشائي — تقدير العمر الاقتصادي", text);
        Assert.DoesNotContain("بأخصائي خارجي:", text);
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
