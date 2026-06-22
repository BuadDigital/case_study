using System.Text.Json;
using RealEstateEval.Application.Rules;

namespace RealEstateEval.Application.Tests;

public class FieldInspectionPayloadAttachmentsTests
{
    [Fact]
    public void Collect_returns_attachment_refs_from_defined_and_feature_photos()
    {
        var attachmentId = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
        using var doc = JsonDocument.Parse(
            $$"""
            {
              "featurePhotoAttachments": {
                "kitchen": {
                  "fileName": "kitchen.jpg",
                  "attachmentId": "{{attachmentId}}"
                }
              },
              "definedPhotos": {
                "front": {
                  "photos": [
                    {
                      "id": 1,
                      "fileName": "front.jpg",
                      "attachmentId": "{{attachmentId}}"
                    }
                  ]
                }
              }
            }
            """);

        var refs = FieldInspectionPayloadAttachments.Collect(doc.RootElement);

        Assert.Equal(2, refs.Count);
        Assert.All(refs, r => Assert.Equal(attachmentId, r.AttachmentId));
        Assert.Contains(refs, r => r.PhotoRef == "feature:kitchen");
        Assert.Contains(refs, r => r.PhotoRef == "slot:front:1");
    }

    [Fact]
    public void HasPhotosWithoutServerAttachment_detects_fileName_without_attachmentId()
    {
        using var doc = JsonDocument.Parse(
            """
            {
              "definedPhotos": {
                "front": {
                  "photos": [
                    { "id": 1, "fileName": "front.jpg" }
                  ]
                }
              }
            }
            """);

        Assert.True(FieldInspectionPayloadAttachments.HasPhotosWithoutServerAttachment(doc.RootElement));
    }

    [Fact]
    public void HasPhotosWithoutServerAttachment_ignores_empty_or_bound_photos()
    {
        var attachmentId = Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc");
        using var doc = JsonDocument.Parse(
            $$"""
            {
              "definedPhotos": {
                "front": {
                  "photos": [
                    {
                      "id": 1,
                      "fileName": "front.jpg",
                      "attachmentId": "{{attachmentId}}"
                    }
                  ]
                }
              },
              "freePhotos": []
            }
            """);

        Assert.False(FieldInspectionPayloadAttachments.HasPhotosWithoutServerAttachment(doc.RootElement));
    }
}
