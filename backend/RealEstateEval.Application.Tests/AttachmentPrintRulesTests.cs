using RealEstateEval.Domain;
using Xunit;

namespace RealEstateEval.Application.Tests;

public class AttachmentPrintRulesTests
{
    [Theory]
    [InlineData("deed", true, true)]
    [InlineData("deed", false, false)]
    [InlineData("", true, false)]
    [InlineData(null, true, false)]
    [InlineData("  ", true, false)]
    public void IsPrintable_requires_type_and_flag(
        string? typeKey,
        bool printInReport,
        bool expected)
    {
        Assert.Equal(expected, AttachmentPrintRules.IsPrintable(typeKey, printInReport));
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
    public void ReportSectionNumber_routes_known_dictionary_keys(string? key, int? expected)
    {
        Assert.Equal(expected, AttachmentPrintRules.ReportSectionNumber(key));
    }

    [Theory]
    [InlineData(false, 6)]
    [InlineData(true, 12)]
    public void PhotoBudget_matches_land_vs_building(bool hasStructures, int expected) =>
        Assert.Equal(expected, AttachmentPrintRules.PhotoBudget(hasStructures));
}
