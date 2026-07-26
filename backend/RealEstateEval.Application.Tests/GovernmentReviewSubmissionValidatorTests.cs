using System.Text.Json;
using RealEstateEval.Application.Rules;

namespace RealEstateEval.Application.Tests;

public class GovernmentReviewSubmissionValidatorTests
{
    [Fact]
    public void Validate_accepts_completed_visit_with_key_handoff_and_proof()
    {
        using var doc = JsonDocument.Parse(MinimalValidPayload());
        var errors = GovernmentReviewSubmissionValidator.Validate(doc.RootElement);
        Assert.Empty(errors);
    }

    [Fact]
    public void Validate_accepts_not_required_keys_without_handoff()
    {
        var json = MinimalValidPayload()
            .Replace("\"keysStatus\": \"received\"", "\"keysStatus\": \"not_required\"")
            .Replace("\"keyHandedToInspector\": \"yes\"", "\"keyHandedToInspector\": \"\"")
            .Replace("\"keysDescription\": \"ظرف في المحكمة\"", "\"keysDescription\": \"\"")
            .Replace(
                """
                "keysProofFiles": [ { "id": "p1", "fileName": "proof.jpg", "mimeType": "image/jpeg", "dataUrl": "data:," } ]
                """,
                "\"keysProofFiles\": []");

        using var doc = JsonDocument.Parse(json);
        var errors = GovernmentReviewSubmissionValidator.Validate(doc.RootElement);
        Assert.Empty(errors);
    }

    [Fact]
    public void Validate_rejects_visit_not_completed()
    {
        var json = MinimalValidPayload()
            .Replace("\"visitStatus\": \"completed\"", "\"visitStatus\": \"scheduled\"");

        using var doc = JsonDocument.Parse(json);
        var errors = GovernmentReviewSubmissionValidator.Validate(doc.RootElement);

        Assert.Equal(
            "لا يمكن إتمام المراجعة قبل تأكيد «تمت الزيارة» — احفظ كمسودة بالانتظار",
            errors["visitStatus"]);
    }

    [Fact]
    public void Validate_rejects_missing_key_handoff()
    {
        var json = MinimalValidPayload()
            .Replace("\"keyHandedToInspector\": \"yes\"", "\"keyHandedToInspector\": \"no\"");

        using var doc = JsonDocument.Parse(json);
        var errors = GovernmentReviewSubmissionValidator.Validate(doc.RootElement);

        Assert.Contains("keyHandedToInspector", errors.Keys);
    }

    [Fact]
    public void Validate_rejects_received_keys_without_proof()
    {
        var json = MinimalValidPayload().Replace(
            """
            "keysProofFiles": [ { "id": "p1", "fileName": "proof.jpg", "mimeType": "image/jpeg", "dataUrl": "data:," } ]
            """,
            "\"keysProofFiles\": []");

        using var doc = JsonDocument.Parse(json);
        var errors = GovernmentReviewSubmissionValidator.Validate(doc.RootElement);

        Assert.Equal(
            "ارفع إثبات استلام المفتاح (صورة أو خطاب)",
            errors["keysProofFiles"]);
    }

    [Fact]
    public void Validate_rejects_unconfirmed_submit()
    {
        var json = MinimalValidPayload()
            .Replace("\"confirmed\": true", "\"confirmed\": false");

        using var doc = JsonDocument.Parse(json);
        var errors = GovernmentReviewSubmissionValidator.Validate(doc.RootElement);

        Assert.Equal("يجب تأكيد اكتمال المراجعة قبل الإرسال", errors["confirmed"]);
    }

    private static string MinimalValidPayload() =>
        """
        {
          "visitStatus": "completed",
          "visitDate": "2026-07-20",
          "keysStatus": "received",
          "keysDescription": "ظرف في المحكمة",
          "keyHandedToInspector": "yes",
          "accessBlockReason": "",
          "keysProofFiles": [ { "id": "p1", "fileName": "proof.jpg", "mimeType": "image/jpeg", "dataUrl": "data:," } ],
          "confirmed": true
        }
        """;
}
