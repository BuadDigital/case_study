using RealEstateEval.Shared.Web;

namespace RealEstateEval.Api.IntegrationTests;

public sealed class ApiV1AliasTests
{
    [Theory]
    [InlineData("api/financial", "api/financial/v1")]
    [InlineData("api/reporting", "api/reporting/v1")]
    [InlineData("api/[controller]", "api/[controller]/v1")]
    [InlineData(
        "api/valuation-requests/{valuationRequestId:guid}/comparable-selections",
        "api/valuation-requests/v1/{valuationRequestId:guid}/comparable-selections")]
    [InlineData(
        "~/api/valuation-requests/{valuationRequestId:guid}/market-approach",
        "~/api/valuation-requests/v1/{valuationRequestId:guid}/market-approach")]
    [InlineData(
        "api/work-orders/{poNumber}/properties/{propertyId:guid}/inspection-limits",
        "api/work-orders/v1/{poNumber}/properties/{propertyId:guid}/inspection-limits")]
    public void ForTemplate_inserts_v1_after_static_prefix(string template, string expected)
    {
        Assert.Equal(expected, ApiV1Alias.ForTemplate(template));
    }

    [Theory]
    [InlineData("api/financial/v1")]
    [InlineData("api/valuation-requests/v1/{id:guid}/report-document")]
    [InlineData("api/foo/v2")]
    [InlineData("health")]
    [InlineData("")]
    [InlineData(null)]
    public void ForTemplate_skips_versioned_and_non_api_templates(string? template)
    {
        Assert.Null(ApiV1Alias.ForTemplate(template));
    }
}
