using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Domain;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// 2026-10-29 ruling: the inspector corrects the bourse type on site from the system's full type list;
/// the change is recorded, a survey the new type needs is asked of the specialist and one it no longer
/// needs is withdrawn; «مطابق» against the inspector's «غير مطابق» needs the specialist's reason.
/// </summary>
public class InspectedTypeChangeTests
{
    [Fact]
    public void The_catalogue_holds_the_47_types_under_their_classification_and_the_six_old_values()
    {
        Assert.Equal(47, PropertyTypeCatalog.All.Count);
        Assert.Equal(PropertyTypeCatalog.Complex, PropertyTypeCatalog.ClassificationOf("مجمع فلل"));
        Assert.Equal(PropertyTypeCatalog.PublicFacility, PropertyTypeCatalog.ClassificationOf("استراحة"));
        Assert.Equal(PropertyTypeCatalog.UnitInBuilding, PropertyTypeCatalog.ClassificationOf("شقة"));
        Assert.Null(PropertyTypeCatalog.ClassificationOf("غير معروف"));
    }

    [Theory]
    [InlineData("مجمع فلل")]
    [InlineData("استراحة")]
    [InlineData("أرض تجارية")]
    [InlineData("أرض")]
    public void The_inspector_may_submit_any_catalogue_type_and_the_old_short_values(string type)
    {
        var payload = "{\"featureValues\":{\"assetSubject\":\"" + type + "\"}}";
        Assert.Equal(type, InspectedPropertyTypeRules.FromPayload(payload));
    }

    [Fact]
    public void A_change_is_reported_only_when_the_type_differs()
    {
        Assert.Null(InspectedPropertyTypeRules.ChangeOf("فيلا", "فيلا", true, true));
        var change = InspectedPropertyTypeRules.ChangeOf("شقة سكنية", "فيلا", false, true);
        Assert.NotNull(change);
        Assert.Equal("شقة سكنية", change.PreviousType);
        Assert.True(change.SurveyRequiredAfter);
    }

    [Fact]
    public void The_survey_rule_reads_the_inspectors_classification()
    {
        var property = new WorkOrderProperty
        {
            Classification = PropertyTypeCatalog.UnitInBuilding,
            PropertyType = "شقة سكنية",
            IdentifierType = PropertyIdentifierType.Deed,
        };
        Assert.False(SurveyRequirementRules.PropertyRequiresSurvey(property));

        property.InspectedPropertyType = "فيلا";
        Assert.True(SurveyRequirementRules.PropertyRequiresSurvey(property));
        // The specialist must add the office; once a survey task is live, nothing is missing.
        Assert.True(SurveyRequirementRules.SurveyMissingAfterTypeChange(property, hasLiveSurveyTask: false));
        Assert.False(SurveyRequirementRules.SurveyMissingAfterTypeChange(property, hasLiveSurveyTask: true));
    }

    [Fact]
    public void A_changed_type_that_needs_a_survey_waits_for_the_office_even_when_the_bourse_type_needed_one()
    {
        // A→Z 2026-11-02 #74: «أرض سكنية» changed to «استراحة» on site — the timeline asked for the office,
        // but the issue gate skipped it because the bourse type needed a survey too; the study was issued.
        var property = new WorkOrderProperty
        {
            Classification = PropertyTypeCatalog.Land,
            PropertyType = "أرض سكنية",
            InspectedPropertyType = "استراحة",
            IdentifierType = PropertyIdentifierType.Deed,
        };
        Assert.True(SurveyRequirementRules.InspectorChangedType(property));
        Assert.True(SurveyRequirementRules.SurveyMissingAfterTypeChange(property, hasLiveSurveyTask: false));
        Assert.False(SurveyRequirementRules.SurveyMissingAfterTypeChange(property, hasLiveSurveyTask: true));
    }

    [Fact]
    public void No_type_change_or_no_survey_need_never_blocks_the_study()
    {
        var sameType = new WorkOrderProperty
        {
            Classification = PropertyTypeCatalog.Land,
            PropertyType = "أرض سكنية",
            InspectedPropertyType = " أرض سكنية ",
            IdentifierType = PropertyIdentifierType.Deed,
        };
        Assert.False(SurveyRequirementRules.SurveyMissingAfterTypeChange(sameType, hasLiveSurveyTask: false));

        var onApprovedPlan = new WorkOrderProperty
        {
            Classification = PropertyTypeCatalog.Land,
            PropertyType = "أرض سكنية",
            InspectedPropertyType = "استراحة",
            IdentifierType = PropertyIdentifierType.Deed,
            PlanNumber = "1234",
            PlotNumber = "56",
        };
        Assert.False(SurveyRequirementRules.SurveyMissingAfterTypeChange(onApprovedPlan, hasLiveSurveyTask: false));
    }

    [Fact]
    public void Matched_against_the_offices_not_matched_needs_a_reason_too()
    {
        // A→Z 2026-11-02 #20: the office said «الصك غير مطابق للطبيعة» and «مطابق» passed with no reason.
        Assert.Equal(
            CaseStudyReportDeedNatureMatchRules.OfficeOverrideReasonRequiredAr,
            CaseStudyReportDeedNatureMatchRules.ValidateForSave("matched", "قصير", officeSaidNotMatched: true)?["deedNatureMatchNotes"]);
        Assert.Null(CaseStudyReportDeedNatureMatchRules.ValidateForSave(
            "matched", "الحدود مطابقة بعد مراجعة المخطط", officeSaidNotMatched: true));
        Assert.Null(CaseStudyReportDeedNatureMatchRules.ValidateForSave("differences", "فرق في الضلع", officeSaidNotMatched: true));
        // Both said «غير مطابق»: one reason, the inspector's message.
        Assert.Equal(
            CaseStudyReportDeedNatureMatchRules.OverrideReasonRequiredAr,
            CaseStudyReportDeedNatureMatchRules.ValidateForSave("matched", "", true, true)?["deedNatureMatchNotes"]);
        // The issue gate applies the same rule.
        Assert.NotNull(CaseStudyReportDeedNatureMatchRules.ValidateForIssue(
            "matched", "", [DeedKind.Traditional], inspectorSaidNotMatched: false, officeSaidNotMatched: true));
    }

    [Fact]
    public void The_offices_verdict_is_read_from_its_survey_package()
    {
        Assert.True(InspectorDeedNatureMatchRules.EngineeringOfficeSaidNotMatched("""{"deedMatchesNature":"no"}"""));
        Assert.True(InspectorDeedNatureMatchRules.EngineeringOfficeSaidNotMatched("""{"deedMatchesNature":false}"""));
        Assert.False(InspectorDeedNatureMatchRules.EngineeringOfficeSaidNotMatched("""{"deedMatchesNature":"yes"}"""));
        Assert.False(InspectorDeedNatureMatchRules.EngineeringOfficeSaidNotMatched("""{"deedMatchesNature":true}"""));
        Assert.False(InspectorDeedNatureMatchRules.EngineeringOfficeSaidNotMatched("""{}"""));
        Assert.False(InspectorDeedNatureMatchRules.EngineeringOfficeSaidNotMatched(null));
        Assert.False(InspectorDeedNatureMatchRules.EngineeringOfficeSaidNotMatched("not json"));
    }

    [Fact]
    public void Matched_against_the_inspectors_not_matched_needs_a_reason()
    {
        Assert.Equal(
            CaseStudyReportDeedNatureMatchRules.OverrideReasonRequiredAr,
            CaseStudyReportDeedNatureMatchRules.ValidateForSave("matched", "", inspectorSaidNotMatched: true)?["deedNatureMatchNotes"]);
        Assert.Null(CaseStudyReportDeedNatureMatchRules.ValidateForSave(
            "matched", "الحدود مطابقة بعد مراجعة المخطط", inspectorSaidNotMatched: true));
        Assert.Null(CaseStudyReportDeedNatureMatchRules.ValidateForSave("matched", "", inspectorSaidNotMatched: false));
    }

    [Fact]
    public void The_inspectors_verdict_is_read_from_his_package()
    {
        Assert.True(InspectorDeedNatureMatchRules.InspectorSaidNotMatched("""{"deedMatchesNature":"no"}"""));
        Assert.False(InspectorDeedNatureMatchRules.InspectorSaidNotMatched("""{"deedMatchesNature":"yes"}"""));
        Assert.False(InspectorDeedNatureMatchRules.InspectorSaidNotMatched(null));
        Assert.False(InspectorDeedNatureMatchRules.InspectorSaidNotMatched("not json"));
    }

    [Fact]
    public void Documents_apply_by_category_to_the_full_type_list()
    {
        Assert.True(PropertyDocumentTypes.AppliesToType(PropertyDocumentTypes.LandPropertyTypes, "أرض سكنية"));
        Assert.True(PropertyDocumentTypes.AppliesToType(PropertyDocumentTypes.BuiltPropertyTypes, "مجمع فلل"));
        Assert.False(PropertyDocumentTypes.AppliesToType(PropertyDocumentTypes.BuiltPropertyTypes, "أرض تجارية"));
        Assert.True(PropertyDocumentTypes.AppliesToType(["شقة"], "شقة سكنية"));
        Assert.False(PropertyDocumentTypes.AppliesToType(["فيلا"], "مجمع فلل"));
        Assert.True(PropertyDocumentTypes.AppliesToType([], "أي نوع"));
    }
}
