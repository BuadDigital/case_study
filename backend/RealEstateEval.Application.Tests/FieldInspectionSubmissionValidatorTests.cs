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
        Assert.Contains("accessContactName", errors.Keys);
        Assert.Contains("accessContactPhone", errors.Keys);
        Assert.Contains("accessContactRole", errors.Keys);
        Assert.Contains("accessRouteDescription", errors.Keys);
        Assert.Contains("inspectionConfirmed", errors.Keys);
    }

    [Fact]
    public void Validate_rejects_missing_access_contact_fields()
    {
        using var doc = JsonDocument.Parse(
            MinimalValidPayload()
                .Replace("\"accessContactName\": \"عبدالرحمن عبدالله الغامدي\",", "\"accessContactName\": \"\",")
                .Replace("\"accessContactPhone\": \"0500000001\",", "\"accessContactPhone\": \"\",")
                .Replace("\"accessContactRole\": \"مالك\",", "\"accessContactRole\": \"\","));
        var errors = FieldInspectionSubmissionValidator.Validate(doc.RootElement);
        Assert.Equal("الاسم مطلوب", errors["accessContactName"]);
        Assert.Equal("رقم الجوال مطلوب", errors["accessContactPhone"]);
        Assert.Equal("الصلة مطلوبة", errors["accessContactRole"]);
        Assert.Equal("أكمل بيانات من سهّل الوصول (الاسم، رقم الجوال، الصلة)", errors["accessRouteDescription"]);
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
    public void Validate_rejects_yes_movables_without_description()
    {
        using var doc = JsonDocument.Parse(
            MinimalValidPayload().Replace(
                "\"featureValues\": {}",
                """ "featureValues": { "movables": "نعم" }, "featurePhotoAttachments": { "movables": { "fileName": "m.jpg", "attachmentId": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3" } } """));
        var errors = FieldInspectionSubmissionValidator.Validate(doc.RootElement);
        Assert.Equal("وصف المنقولات مطلوب عند اختيار «نعم»", errors["movablesDescription"]);
    }

    [Fact]
    public void Validate_accepts_yes_movables_with_description()
    {
        using var doc = JsonDocument.Parse(
            MinimalValidPayload().Replace(
                "\"featureValues\": {}",
                """ "featureValues": { "movables": "نعم", "movablesDescription": "أثاث ومكيفات" }, "featurePhotoAttachments": { "movables": { "fileName": "m.jpg", "attachmentId": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3" } } """));
        var errors = FieldInspectionSubmissionValidator.Validate(doc.RootElement);
        Assert.DoesNotContain("movablesDescription", errors.Keys);
    }

    [Fact]
    public void Validate_rejects_occupied_without_description()
    {
        using var doc = JsonDocument.Parse(
            MinimalValidPayload().Replace(
                "\"featureValues\": {}",
                """ "featureValues": { "occupancyState": "مشغول" } """));
        var errors = FieldInspectionSubmissionValidator.Validate(doc.RootElement);
        Assert.Equal("سبب الإشغال مطلوب عند اختيار «مشغول»", errors["occupancyDescription"]);
    }

    [Fact]
    public void Validate_accepts_occupied_with_description()
    {
        using var doc = JsonDocument.Parse(
            MinimalValidPayload().Replace(
                "\"featureValues\": {}",
                """ "featureValues": { "occupancyState": "مشغول", "occupancyDescription": "مستأجر حتى نهاية العقد" } """));
        var errors = FieldInspectionSubmissionValidator.Validate(doc.RootElement);
        Assert.DoesNotContain("occupancyDescription", errors.Keys);
    }

    [Fact]
    public void Validate_rejects_observation_missing_text()
    {
        var json = MinimalValidPayload().Replace(
            "\"observations\": []",
            """
            "observations": [
              { "id": "obs-1", "category": "عيب ظاهر", "text": "", "photo": null }
            ]
            """);

        using var doc = JsonDocument.Parse(json);
        var errors = FieldInspectionSubmissionValidator.Validate(doc.RootElement);

        Assert.Equal("كل ملاحظة يجب أن تتضمن شرحاً", errors["observations"]);
    }

    [Fact]
    public void Validate_accepts_observation_with_text_and_no_photo()
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

        Assert.DoesNotContain("observations", errors.Keys);
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
    public void Validate_skips_building_features_and_showroom_photo_on_land()
    {
        var json = MinimalValidPayload()
            .Replace("\"featureValues\": {}", """ "featureValues": { "assetSubject": "أرض", "kitchen": "نعم" } """)
            .Replace("\"showroomCount\": \"\"", "\"showroomCount\": \"2\"")
            .Replace("\"inspectionConfirmed\": true", "\"inspectionConfirmed\": true, \"vacantLand\": true");

        using var doc = JsonDocument.Parse(json);
        var errors = FieldInspectionSubmissionValidator.Validate(doc.RootElement);

        Assert.DoesNotContain("featurePhotos", errors.Keys);
        Assert.DoesNotContain("componentPhotos", errors.Keys);
    }

    [Fact]
    public void Validate_skips_leftover_facade_photo_when_subject_is_land()
    {
        var json = MinimalValidPayload()
            .Replace("\"featureValues\": {}", """ "featureValues": { "assetSubject": "أرض", "facade": "شمالية" } """);

        using var doc = JsonDocument.Parse(json);
        var errors = FieldInspectionSubmissionValidator.Validate(doc.RootElement);

        Assert.DoesNotContain("featurePhotos", errors.Keys);
    }

    [Fact]
    public void Validate_skips_leftover_facade_photo_when_subject_is_ardi()
    {
        var json = MinimalValidPayload()
            .Replace("\"featureValues\": {}", """ "featureValues": { "assetSubject": "أرضي", "facade": "شمالية" } """);

        using var doc = JsonDocument.Parse(json);
        var errors = FieldInspectionSubmissionValidator.Validate(doc.RootElement);

        Assert.DoesNotContain("featurePhotos", errors.Keys);
    }

    [Fact]
    public void Validate_does_not_require_proof_photo_for_asset_subject_or_usage()
    {
        var json = MinimalValidPayload()
            .Replace(
                "\"featureValues\": {}",
                """ "featureValues": { "assetSubject": "أرض", "propertyUsage": "سكني" } """);

        using var doc = JsonDocument.Parse(json);
        var errors = FieldInspectionSubmissionValidator.Validate(doc.RootElement);

        Assert.DoesNotContain("featurePhotos", errors.Keys);
    }

    [Fact]
    public void Validate_skips_well_photo_on_commercial_shop()
    {
        var json = MinimalValidPayload()
            .Replace("\"featureValues\": {}", """ "featureValues": { "assetSubject": "محل تجاري" } """)
            .Replace("\"wellCount\": \"\"", "\"wellCount\": \"2\"")
            .Replace("\"showroomCount\": \"\"", "\"showroomCount\": \"1\"");

        using var doc = JsonDocument.Parse(json);
        var errors = FieldInspectionSubmissionValidator.Validate(doc.RootElement);

        Assert.Contains("componentPhotos", errors.Keys);
        Assert.Contains("المعرض", errors["componentPhotos"]);
        Assert.DoesNotContain("البئر", errors["componentPhotos"]);
    }

    [Fact]
    public void Validate_requires_service_slot_photo_when_service_selected()
    {
        var json = MinimalValidPayload().Replace(
            """
            "services": ["كهرباء"]
            """,
            """
            "services": ["كهرباء", "مياه"]
            """);

        using var doc = JsonDocument.Parse(json);
        var errors = FieldInspectionSubmissionValidator.Validate(doc.RootElement);

        Assert.Contains("خدمة", errors["definedPhotos"]);
    }

    [Fact]
    public void Validate_rejects_photos_not_uploaded_to_server()
    {
        var json = MinimalValidPayload().Replace(
            $"\"attachmentId\": \"{ServicePhotoAttachmentId}\"",
            "\"attachmentId\": null",
            StringComparison.Ordinal);

        using var doc = JsonDocument.Parse(json);
        var errors = FieldInspectionSubmissionValidator.Validate(doc.RootElement);

        Assert.Equal("يجب رفع الصور إلى الخادم قبل الإرسال", errors["definedPhotos"]);
    }

    private static readonly Guid ServicePhotoAttachmentId =
        Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1");
    private static readonly Guid AmenityPhotoAttachmentId =
        Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2");

    private static string MinimalValidPayload() =>
        $$"""
        {
          "inspectionDate": "2026-06-21",
          "inspectionTime": "10:30",
          "mapLatitude": "21.481000",
          "mapLongitude": "39.186500",
          "accessContactName": "عبدالرحمن عبدالله الغامدي",
          "accessContactPhone": "0500000001",
          "accessContactRole": "مالك",
          "accessRouteDescription": "مالك، عبدالرحمن عبدالله الغامدي، رقم الجوال 0500000001",
          "inspectionConfirmed": true,
          "hasAnnex": "لا",
          "showroomCount": "",
          "wellCount": "",
          "featureValues": {},
          "featurePhotoAttachments": {},
          "componentPhotoAttachments": { "showroom": null, "well": null },
          "observations": [],
          "freePhotos": [],
          "services": ["كهرباء"],
          "amenities": ["مساجد"],
          "definedPhotos": {
            "service:كهرباء": {
              "none": false,
              "photos": [
                {
                  "id": 1,
                  "approved": true,
                  "fileName": "electricity.jpg",
                  "mimeType": "image/jpeg",
                  "attachmentId": "{{ServicePhotoAttachmentId}}"
                }
              ]
            },
            "amenity:مساجد": {
              "none": false,
              "photos": [
                {
                  "id": 2,
                  "approved": true,
                  "fileName": "mosque.jpg",
                  "mimeType": "image/jpeg",
                  "attachmentId": "{{AmenityPhotoAttachmentId}}"
                }
              ]
            }
          }
        }
        """;
}
