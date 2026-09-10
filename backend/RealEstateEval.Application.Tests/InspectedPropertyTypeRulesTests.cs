using RealEstateEval.CaseStudy.Application.Rules;

namespace RealEstateEval.Application.Tests;

public sealed class InspectedPropertyTypeRulesTests
{
    [Theory]
    [InlineData("فيلا", "فيلا")]
    [InlineData("أرض", "أرض")]
    [InlineData("شقة", "شقة")]
    public void FromPayload_ReturnsClosedListAssetSubject(string value, string expected)
    {
        var payload = "{\"featureValues\":{\"assetSubject\":\"" + value + "\"}}";

        Assert.Equal(expected, InspectedPropertyTypeRules.FromPayload(payload));
    }

    [Fact]
    public void FromPayload_RejectsUnknownOrMissingValue()
    {
        Assert.Null(InspectedPropertyTypeRules.FromPayload(
            """{"featureValues":{"assetSubject":"غير معروف"}}"""));
        Assert.Null(InspectedPropertyTypeRules.FromPayload("""{"featureValues":{}}"""));
    }

    [Theory]
    [InlineData("أرض")]
    [InlineData("ارض")]
    [InlineData("land")]
    public void IsLand_NormalizesArabicHamzaAndEnglish(string value)
    {
        Assert.True(InspectedPropertyTypeRules.IsLand(value));
    }

    [Fact]
    public void Effective_UsesInitialBeforeSubmission_ThenInspected()
    {
        Assert.Equal("فيلا", InspectedPropertyTypeRules.Effective("فيلا", null));
        Assert.Equal("أرض", InspectedPropertyTypeRules.Effective("فيلا", "أرض"));
        Assert.Equal("فيلا", InspectedPropertyTypeRules.Effective("أرض", "فيلا"));
    }

    [Fact]
    public void NormalizePayload_LandWinsAndClearsStaleBuildingAnswers()
    {
        const string payload =
            """
            {
              "vacantLand": false,
              "featureValues": {
                "assetSubject": "أرض",
                "buildState": "جيد",
                "occupancyState": "مشغول"
              },
              "featurePhotoAttachments": {
                "buildState": ["building.jpg"]
              }
            }
            """;

        var result = InspectedPropertyTypeRules.NormalizePayloadForSubmission(
            payload,
            "أرض");

        Assert.Contains("\"vacantLand\":true", result);
        Assert.Contains("\"buildState\":\"\"", result);
        Assert.DoesNotContain("building.jpg", result);
    }

    [Fact]
    public void FromPayload_DetectsStaffAttemptToChangeInspectorOwnedType()
    {
        const string submitted =
            """{"featureValues":{"assetSubject":"فيلا","facade":"شمالية"},"propertyDescription":"وصف المعاين"}""";
        const string corrected =
            """{"featureValues":{"assetSubject":"أرض","facade":"غربية"},"propertyDescription":"وصف الأخصائي"}""";

        Assert.Equal("فيلا", InspectedPropertyTypeRules.FromPayload(submitted));
        Assert.Equal("أرض", InspectedPropertyTypeRules.FromPayload(corrected));
        Assert.False(string.Equals(
            InspectedPropertyTypeRules.FromPayload(submitted),
            InspectedPropertyTypeRules.FromPayload(corrected),
            StringComparison.Ordinal));
        Assert.Equal(
            "فيلا",
            InspectedPropertyTypeRules.FromPayload(
                """{"featureValues":{"assetSubject":"فيلا","facade":"غربية"},"propertyDescription":"وصف الأخصائي"}"""));
    }
}
