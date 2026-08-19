using System.Text.Json;
using RealEstateEval.Application.Rules;

namespace RealEstateEval.Application.Tests;

public class PropertyAppraisalSubmissionValidatorTests
{
    [Fact]
    public void Validate_accepts_when_asset_data_confirmed()
    {
        using var doc = JsonDocument.Parse(MinimalValidPayload(confirmed: true, notes: ""));
        var errors = PropertyAppraisalSubmissionValidator.Validate(doc.RootElement);
        Assert.Empty(errors);
    }

    [Fact]
    public void Validate_accepts_when_variance_notes_provided()
    {
        using var doc = JsonDocument.Parse(
            MinimalValidPayload(confirmed: false, notes: "فرق في مساحة البناء."));
        var errors = PropertyAppraisalSubmissionValidator.Validate(doc.RootElement);
        Assert.Empty(errors);
    }

    [Fact]
    public void Validate_rejects_when_neither_confirmed_nor_notes()
    {
        using var doc = JsonDocument.Parse(MinimalValidPayload(confirmed: false, notes: ""));
        var errors = PropertyAppraisalSubmissionValidator.Validate(doc.RootElement);

        Assert.Equal(
            "أكّد مراجعة بيانات الأصل، أو دوّن ملاحظات التباين إن وُجدت.",
            errors["asset_data_confirmed"]);
    }

    [Fact]
    public void Validate_rejects_missing_price_and_report()
    {
        using var doc = JsonDocument.Parse(
            """
            {
              "evaluatorPrice": "",
              "reportFileName": "",
              "assetDataConfirmed": true,
              "assetDataVarianceNotes": "",
              "independenceDeclared": true,
              "reportWorkers": [{ "name": "أحمد", "role": "معد" }]
            }
            """);
        var errors = PropertyAppraisalSubmissionValidator.Validate(doc.RootElement);

        Assert.Equal("سعر التقييم مطلوب", errors["evaluatorPrice"]);
        Assert.Equal("تقرير PDF مطلوب", errors["reportFileName"]);
    }

    [Fact]
    public void Validate_rejects_missing_independence()
    {
        using var doc = JsonDocument.Parse(MinimalValidPayload(confirmed: true, notes: ""));
        using var missing = JsonDocument.Parse(
            """
            {
              "evaluatorPrice": "1250000",
              "reportFileName": "appraisal.pdf",
              "assetDataConfirmed": true,
              "independenceDeclared": false,
              "reportWorkers": [{ "name": "أحمد", "role": "معد" }]
            }
            """);
        var errors = PropertyAppraisalSubmissionValidator.Validate(missing.RootElement);
        Assert.Equal(
            "يجب تأكيد إقرار الاستقلالية وعدم تضارب المصالح.",
            errors["independence_declared"]);
        Assert.Empty(PropertyAppraisalSubmissionValidator.Validate(doc.RootElement));
    }

    [Fact]
    public void Validate_rejects_missing_report_worker()
    {
        using var doc = JsonDocument.Parse(
            """
            {
              "evaluatorPrice": "1250000",
              "reportFileName": "appraisal.pdf",
              "assetDataConfirmed": true,
              "independenceDeclared": true,
              "reportWorkers": []
            }
            """);
        var errors = PropertyAppraisalSubmissionValidator.Validate(doc.RootElement);
        Assert.Equal(
            "أضف عاملاً واحداً على الأقل على التقرير (الدور والاسم).",
            errors["report_workers"]);
    }

    private static string MinimalValidPayload(bool confirmed, string notes) =>
        $$"""
        {
          "evaluatorPrice": "1250000",
          "reportFileName": "appraisal.pdf",
          "assetDataConfirmed": {{(confirmed ? "true" : "false")}},
          "assetDataVarianceNotes": {{JsonSerializer.Serialize(notes)}},
          "independenceDeclared": true,
          "reportWorkers": [{ "name": "أحمد", "role": "معد" }]
        }
        """;
}
