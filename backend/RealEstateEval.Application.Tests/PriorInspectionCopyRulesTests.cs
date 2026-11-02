using System.Text.Json;
using RealEstateEval.CaseStudy.Application.Rules;

namespace RealEstateEval.Application.Tests;

/// <summary>2026-11-01: the inspector copies an earlier inspection of the deed — everything but the photos.</summary>
public class PriorInspectionCopyRulesTests
{
    private const string Stored = """
    {
      "propertyDescription": "فيلا دورين",
      "mapLatitude": "24.45",
      "mapLongitude": "39.61",
      "roomCount": "6",
      "featureValues": { "assetSubject": "فيلا" },
      "services": ["electricity"],
      "boundaryMatches": { "north": { "matches": true, "mismatchNote": "" } },
      "observations": [ { "id": "o1", "category": "general", "text": "شرخ", "photo": { "attachmentId": "a1" } } ],
      "definedPhotos": { "service:electricity": { "photos": [ { "attachmentId": "a2" } ] } },
      "freePhotos": [ { "attachmentId": "a3" } ],
      "featurePhotoAttachments": { "x": { "attachmentId": "a4" } },
      "componentPhotoAttachments": { "x": { "attachmentId": "a5" } },
      "siteAttendedBy": "سعد المالكي",
      "inspectionDate": "2026-01-01",
      "inspectionTime": "10:00",
      "completedOnSiteAtUtc": "2026-01-01T07:00:00Z",
      "mapPinned": true,
      "inspectorMapLatitude": "24.45",
      "inspectionConfirmed": true,
      "clientDeclarationSigned": true,
      "status": "submitted"
    }
    """;

    private static JsonElement Copy() => PriorInspectionCopyRules.CopyablePayload(Stored);

    [Fact]
    public void Keeps_what_the_inspector_recorded_about_the_property()
    {
        var copy = Copy();

        Assert.Equal("فيلا دورين", copy.GetProperty("propertyDescription").GetString());
        Assert.Equal("24.45", copy.GetProperty("mapLatitude").GetString());
        Assert.Equal("6", copy.GetProperty("roomCount").GetString());
        Assert.Equal("فيلا", copy.GetProperty("featureValues").GetProperty("assetSubject").GetString());
        Assert.True(copy.GetProperty("boundaryMatches").GetProperty("north").GetProperty("matches").GetBoolean());
        Assert.Equal("electricity", copy.GetProperty("services")[0].GetString());
    }

    [Fact]
    public void Copies_no_photo_at_any_depth()
    {
        var copy = Copy();

        Assert.DoesNotContain("attachmentId", copy.GetRawText());
        foreach (var key in new[] { "definedPhotos", "freePhotos", "featurePhotoAttachments", "componentPhotoAttachments" })
            Assert.False(copy.TryGetProperty(key, out _), key);
        var observation = copy.GetProperty("observations")[0];
        Assert.Equal("شرخ", observation.GetProperty("text").GetString());
        Assert.False(observation.TryGetProperty("photo", out _));
    }

    [Fact]
    public void Leaves_the_facts_of_the_earlier_visit_behind()
    {
        var copy = Copy();

        foreach (var key in new[]
                 {
                     "siteAttendedBy", "inspectionDate", "inspectionTime", "completedOnSiteAtUtc", "mapPinned",
                     "inspectorMapLatitude", "inspectionConfirmed", "clientDeclarationSigned", "status",
                 })
            Assert.False(copy.TryGetProperty(key, out _), key);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("[]")]
    public void A_blank_payload_copies_nothing(string? stored) =>
        Assert.Equal("{}", PriorInspectionCopyRules.CopyablePayload(stored).GetRawText());
}
