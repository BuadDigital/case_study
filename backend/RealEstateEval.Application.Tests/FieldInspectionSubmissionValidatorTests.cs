using System.Text.Json;
using RealEstateEval.Application.Rules;
namespace RealEstateEval.Application.Tests;

public class FieldInspectionSubmissionValidatorTests
{
    [Fact]
    public void Validate_accepts_minimal_complete_payload()
    {
        using var doc = JsonDocument.Parse(MinimalValidPayload());
        var errors = FieldInspectionSubmissionValidator.Validate(doc.RootElement);
        Assert.Empty(errors);
    }

    [Fact]
    public void Validate_rejects_missing_core_fields()
    {
        using var doc = JsonDocument.Parse("{}");
        var errors = FieldInspectionSubmissionValidator.Validate(doc.RootElement);

        Assert.Contains("inspectionDate", errors.Keys);
        Assert.Contains("inspectionTime", errors.Keys);
        Assert.Contains("mapLatitude", errors.Keys);
        Assert.Contains("inspectionConfirmed", errors.Keys);
    }

    [Fact]
    public void Validate_rejects_coordinates_outside_saudi_arabia()
    {
        using var doc = JsonDocument.Parse(
            MinimalValidPayload().Replace("\"21.481000\"", "\"0.003054\"")
                .Replace("\"39.186500\"", "\"0.005699\""));
        var errors = FieldInspectionSubmissionValidator.Validate(doc.RootElement);

        Assert.Equal("يجب تحديد موقع العقار (GPS)", errors["mapLatitude"]);
    }

    [Fact]
    public void Validate_rejects_incomplete_observation()
    {
        var json = MinimalValidPayload().Replace(
            "\"observations\": []",
            """
            "observations": [
              { "id": "obs-1", "category": "عيب ظاهر", "text": "شق في الجدار", "photo": null }
            ]
            """);

        using var doc = JsonDocument.Parse(json);
        var errors = FieldInspectionSubmissionValidator.Validate(doc.RootElement);

        Assert.Equal(
            "كل ملاحظة موثّقة يجب أن تتضمن شرحاً وصورة توثيقية",
            errors["observations"]);
    }

    [Fact]
    public void Validate_requires_showroom_photo_when_count_positive()
    {
        var json = MinimalValidPayload().Replace(
            "\"showroomCount\": \"\"",
            "\"showroomCount\": \"2\"");

        using var doc = JsonDocument.Parse(json);
        var errors = FieldInspectionSubmissionValidator.Validate(doc.RootElement);

        Assert.Equal("يجب إرفاق صورة المعرض", errors["componentPhotos"]);
    }

    [Fact]
    public void Validate_requires_feature_photo_when_value_is_yes()
    {
        var json = MinimalValidPayload().Replace(
            "\"featureValues\": {}",
            """
            "featureValues": { "kitchen": "نعم" }
            """);

        using var doc = JsonDocument.Parse(json);
        var errors = FieldInspectionSubmissionValidator.Validate(doc.RootElement);

        Assert.Contains("توثيقية", errors["featurePhotos"]);
    }

    [Fact]
    public void Validate_requires_annex_slots_when_has_annex_yes()
    {
        var json = MinimalValidPayload().Replace(
            "\"hasAnnex\": \"لا\"",
            "\"hasAnnex\": \"نعم\"");

        using var doc = JsonDocument.Parse(json);
        var errors = FieldInspectionSubmissionValidator.Validate(doc.RootElement);

        Assert.Contains("definedPhotos", errors.Keys);
        Assert.Contains("الموثّقة", errors["definedPhotos"]);
    }

    [Fact]
    public void Validate_rejects_photos_not_uploaded_to_server()
    {
        var json = MinimalValidPayload().Replace(
            $"\"attachmentId\": \"{FrontPhotoAttachmentId}\"",
            "\"attachmentId\": null",
            StringComparison.Ordinal);

        using var doc = JsonDocument.Parse(json);
        var errors = FieldInspectionSubmissionValidator.Validate(doc.RootElement);

        Assert.Equal("يجب رفع الصور إلى الخادم قبل الإرسال", errors["definedPhotos"]);
    }

    private static readonly Guid FrontPhotoAttachmentId =
        Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1");
    private static readonly Guid WaterPhotoAttachmentId =
        Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2");
    private static readonly Guid ElecPhotoAttachmentId =
        Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3");
    private static readonly Guid InsidePhotoAttachmentId =
        Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4");

    private static string MinimalValidPayload() =>
        $$"""
        {
          "inspectionDate": "2026-06-21",
          "inspectionTime": "10:30",
          "mapLatitude": "21.481000",
          "mapLongitude": "39.186500",
          "inspectionConfirmed": true,
          "hasAnnex": "لا",
          "showroomCount": "",
          "wellCount": "",
          "featureValues": {},
          "featurePhotoAttachments": {},
          "componentPhotoAttachments": { "showroom": null, "well": null },
          "observations": [],
          "freePhotos": [],
          "definedPhotos": {
            "front": {
              "none": false,
              "photos": [
                {
                  "id": 1,
                  "approved": true,
                  "fileName": "front.jpg",
                  "mimeType": "image/jpeg",
                  "attachmentId": "{{FrontPhotoAttachmentId}}"
                }
              ]
            },
            "sides": { "none": true, "photos": [] },
            "water": {
              "none": false,
              "photos": [
                {
                  "id": 2,
                  "approved": true,
                  "fileName": "water.jpg",
                  "mimeType": "image/jpeg",
                  "attachmentId": "{{WaterPhotoAttachmentId}}"
                }
              ]
            },
            "elec": {
              "none": false,
              "photos": [
                {
                  "id": 3,
                  "approved": true,
                  "fileName": "elec.jpg",
                  "mimeType": "image/jpeg",
                  "attachmentId": "{{ElecPhotoAttachmentId}}"
                }
              ]
            },
            "inside": {
              "none": false,
              "photos": [
                {
                  "id": 4,
                  "approved": true,
                  "fileName": "inside.jpg",
                  "mimeType": "image/jpeg",
                  "attachmentId": "{{InsidePhotoAttachmentId}}"
                }
              ]
            },
            "floor": { "none": false, "photos": [] },
            "annexup": { "none": false, "photos": [] },
            "annexdn": { "none": false, "photos": [] }
          }
        }
        """;
}
