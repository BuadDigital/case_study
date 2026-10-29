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
    public void A_survey_the_bourse_type_already_needed_is_left_to_the_distribution()
    {
        var property = new WorkOrderProperty
        {
            Classification = PropertyTypeCatalog.Complex,
            PropertyType = "مجمع فلل",
            InspectedPropertyType = "فيلا",
            IdentifierType = PropertyIdentifierType.Deed,
        };
        Assert.False(SurveyRequirementRules.SurveyMissingAfterTypeChange(property, hasLiveSurveyTask: false));
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
