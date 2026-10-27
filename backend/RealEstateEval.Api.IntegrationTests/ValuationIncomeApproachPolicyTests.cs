extern alias ValuationApi;

using System.Reflection;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RealEstateEval.Shared.Web.Authorization;

namespace RealEstateEval.Api.IntegrationTests;

/// <summary>
/// The income approach sits on the same policies as the cost approach: anyone who reads the
/// report reads it; only the assigned appraiser (SubmitValuationReport) writes it.
/// </summary>
public class ValuationIncomeApproachPolicyTests
{
    private static readonly Type Controller =
        typeof(ValuationApi::RealEstateEval.Valuation.Api.Controllers.ValuationIncomeApproachController);

    [Fact]
    public void The_route_is_the_requests_income_approach()
    {
        var route = Controller.GetCustomAttribute<RouteAttribute>()!.Template;

        Assert.Equal("api/valuation-requests/{valuationRequestId:guid}/income-approach", route);
    }

    [Fact]
    public void The_read_is_on_the_report_read_policy()
    {
        var method = Controller.GetMethod("Get")!;

        Assert.NotNull(method.GetCustomAttribute<HttpGetAttribute>());
        Assert.Equal(
            [CapabilityPolicyNames.ReadValuationReport],
            method.GetCustomAttributes<AuthorizeAttribute>().Select(a => a.Policy).ToList());
    }

    [Fact]
    public void The_save_is_the_assigned_appraisers_write()
    {
        var method = Controller.GetMethod("Save")!;

        Assert.NotNull(method.GetCustomAttribute<HttpPutAttribute>());
        Assert.Equal(
            [CapabilityPolicyNames.SubmitValuationReport],
            method.GetCustomAttributes<AuthorizeAttribute>().Select(a => a.Policy).ToList());
        Assert.Contains(
            method.GetCustomAttributes(inherit: true),
            a => a.GetType().Name == "RequireAssignedAppraiserAttribute");
    }
}
