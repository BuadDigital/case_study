using System.Text.Json;
using RealEstateEval.Application.Rules;

namespace RealEstateEval.Application.Tests;

public class PropertyAppraisalSubmissionValidatorTests
{
    [Fact]
    public void Validate_accepts_minimal_valid_payload()
    {
        using var doc = JsonDocument.Parse(MinimalValidPayload());
        var errors = PropertyAppraisalSubmissionValidator.Validate(doc.RootElement);
        Assert.Empty(errors);
    }

    [Fact]
    public void Validate_rejects_missing_price()
    {
        using var doc = JsonDocument.Parse(
            """
            {
              "evaluatorPrice": "",
              "independenceDeclared": true,
              "reportWorkers": [{ "name": "أحمد", "role": "معد" }]
            }
            """);
        var errors = PropertyAppraisalSubmissionValidator.Validate(doc.RootElement);

        Assert.Equal("سعر التقييم مطلوب", errors["evaluatorPrice"]);
        Assert.False(errors.ContainsKey("reportFileName"));
    }

    [Fact]
    public void Validate_rejects_missing_independence()
    {
        using var doc = JsonDocument.Parse(MinimalValidPayload());
        using var missing = JsonDocument.Parse(
            """
            {
              "evaluatorPrice": "1250000",
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
              "independenceDeclared": true,
              "reportWorkers": []
            }
            """);
        var errors = PropertyAppraisalSubmissionValidator.Validate(doc.RootElement);
        Assert.Equal(
            "أضف عاملاً واحداً على الأقل على التقرير (الدور والاسم).",
            errors["report_workers"]);
    }

    private static string MinimalValidPayload() =>
        """
        {
          "evaluatorPrice": "1250000",
          "independenceDeclared": true,
          "reportWorkers": [{ "name": "أحمد", "role": "معد" }]
        }
        """;
}
