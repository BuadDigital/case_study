using RealEstateEval.Domain;
using Xunit;
using RealEstateEval.Attachments.Domain;

namespace RealEstateEval.Application.Tests;

public class AttachmentPrintRulesTests
{
    [Theory]
    [InlineData("property-deed-ownership", "deed")]
    [InlineData("property-bourse-deed", "deed")]
    [InlineData("property-registry", "deed")]
    [InlineData("engineering-survey-report", "survey")]
    [InlineData("field-inspection-photo", "photo")]
    [InlineData("engineering-site-letter", "site-map")]
    [InlineData("property-other", null)]
    [InlineData("", null)]
    [InlineData(null, null)]
    public void TypeKeyFromScope_routes_known_upload_scopes(string? scope, string? expected)
    {
        Assert.Equal(expected, AttachmentPrintRules.TypeKeyFromScope(scope));
    }

    [Theory]
    [InlineData("property-decree")]
    [InlineData("property-delegation")]
    public void TypeKeyFromScope_never_prints_assignment_or_delegation_letters_as_the_deed(string scope)
    {
        Assert.Null(AttachmentPrintRules.TypeKeyFromScope(scope));
    }

    [Theory]
    [InlineData("bourse-deed", "deed")]
    [InlineData("building-permit", "building-permit")]
    [InlineData("zoning-sketch", "zoning-sketch")]
    [InlineData("lease-contract", null)]
    [InlineData("unlisted", null)]
    public void TypeKeyFor_prefers_the_stored_document_type(string documentTypeKey, string? expected)
    {
        Assert.Equal(
            expected,
            AttachmentPrintRules.TypeKeyFor(PropertyDocumentTypes.GovernedScope, documentTypeKey));
    }

    [Fact]
    public void TypeKeyFor_routes_the_inspector_building_permit_photo_to_the_permit_section()
    {
        Assert.Equal(
            "building-permit",
            AttachmentPrintRules.TypeKeyFor("field-inspection-photo", null, "task-1:component:buildLicense"));
        Assert.Equal(
            "photo",
            AttachmentPrintRules.TypeKeyFor("field-inspection-photo", null, "task-1:feature:facade"));
    }

    [Theory]
    [InlineData("deed", 25)]
    [InlineData("survey", 24)]
    [InlineData("photo", 23)]
    [InlineData("photos", 23)]
    [InlineData("zoning-sketch", 22)]
    [InlineData("building-permit", 22)]
    [InlineData("site-map", 22)]
    [InlineData("unknown", null)]
    [InlineData("", null)]
    [InlineData(null, null)]
    public void ReportSectionNumber_routes_known_type_keys(string? key, int? expected)
    {
        Assert.Equal(expected, AttachmentPrintRules.ReportSectionNumber(key));
    }

    [Theory]
    [InlineData(false, 6)]
    [InlineData(true, 12)]
    public void PhotoBudget_matches_land_vs_building(bool hasStructures, int expected) =>
        Assert.Equal(expected, AttachmentPrintRules.PhotoBudget(hasStructures));
}
