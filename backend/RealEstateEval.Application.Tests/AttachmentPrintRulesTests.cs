using RealEstateEval.Domain;
using Xunit;

namespace RealEstateEval.Application.Tests;

public class AttachmentPrintRulesTests
{
    [Theory]
    [InlineData("property-decree", "deed")]
    [InlineData("property-deed-ownership", "deed")]
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
