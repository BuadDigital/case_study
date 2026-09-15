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
              "evaluatorPrice": ""
            }
            """);
        var errors = PropertyAppraisalSubmissionValidator.Validate(doc.RootElement);

        Assert.Equal("سعر التقييم مطلوب", errors["evaluatorPrice"]);
        Assert.False(errors.ContainsKey("reportFileName"));
    }

    [Fact]
    public void Validate_does_not_require_independence_or_report_workers()
    {
        using var doc = JsonDocument.Parse(
            """
            {
              "evaluatorPrice": "1250000",
              "independenceDeclared": false,
              "reportWorkers": []
            }
            """);
        var errors = PropertyAppraisalSubmissionValidator.Validate(doc.RootElement);
        Assert.False(errors.ContainsKey("independence_declared"));
        Assert.False(errors.ContainsKey("report_workers"));
        Assert.Empty(errors);
    }

    private static string MinimalValidPayload() =>
        """
        {
          "evaluatorPrice": "1250000"
        }
        """;
}
