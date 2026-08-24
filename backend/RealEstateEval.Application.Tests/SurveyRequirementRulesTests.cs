using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;

namespace RealEstateEval.Application.Tests;

public class SurveyRequirementRulesTests
{
    [Fact]
    public void Unit_inside_building_does_not_require_survey()
    {
        var prop = new WorkOrderProperty
        {
            Classification = "وحدة داخل مبنى",
            IdentifierType = PropertyIdentifierType.Deed,
        };
        Assert.False(SurveyRequirementRules.PropertyRequiresSurvey(prop));
    }

    [Fact]
    public void Real_estate_registration_identifier_does_not_require_survey()
    {
        var prop = new WorkOrderProperty
        {
            Classification = "أرض",
            IdentifierType = PropertyIdentifierType.RealEstateRegistration,
        };
        Assert.True(SurveyRequirementRules.HasRegisteredTitle(prop));
        Assert.False(SurveyRequirementRules.PropertyRequiresSurvey(prop));
    }

    [Fact]
    public void Real_estate_reg_number_does_not_require_survey()
    {
        var prop = new WorkOrderProperty
        {
            Classification = "أرض",
            IdentifierType = PropertyIdentifierType.Deed,
            RealEstateRegNumber = "3101120066501234",
        };
        Assert.False(SurveyRequirementRules.PropertyRequiresSurvey(prop));
    }

    [Fact]
    public void Traditional_deed_land_requires_survey()
    {
        var prop = new WorkOrderProperty
        {
            Classification = "أرض",
            IdentifierType = PropertyIdentifierType.Deed,
            DeedKind = DeedKind.Traditional,
        };
        Assert.True(SurveyRequirementRules.PropertyRequiresSurvey(prop));
    }
}
