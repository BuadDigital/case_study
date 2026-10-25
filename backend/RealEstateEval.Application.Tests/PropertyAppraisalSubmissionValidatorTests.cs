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

    [Theory]
    [InlineData("\"abc\"", false)]
    [InlineData("\"0\"", false)]
    [InlineData("\"-5\"", false)]
    [InlineData("\"1e30\"", false)]
    [InlineData("\"1,250,000\"", true)]
    [InlineData("\"١٢٥٠٠٠٠\"", true)]
    [InlineData("1250000", true)]
    [InlineData("true", false)]
    public void The_handed_over_price_must_be_a_positive_number(string price, bool valid)
    {
        using var doc = JsonDocument.Parse($$"""{ "evaluatorPrice": {{price}} }""");
        var errors = PropertyAppraisalSubmissionValidator.Validate(doc.RootElement);

        Assert.Equal(valid, !errors.ContainsKey("evaluatorPrice"));
    }

    private static string MinimalValidPayload() =>
        """
        {
          "evaluatorPrice": "1250000"
        }
        """;
}
