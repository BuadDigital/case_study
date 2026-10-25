extern alias ValuationApi;

using System.Reflection;
using Microsoft.AspNetCore.Authorization;
using RealEstateEval.Shared.Web.Authorization;

namespace RealEstateEval.Api.IntegrationTests;

/// <summary>
/// The case specialist (manage-work-orders, no valuation capability) reads the issuance gates of the
/// report she prepares — the route sits on ReadValuationReport, not the operator-queue policy (was 403).
/// </summary>
public class ValuationIssuanceGatesPolicyTests
{
    [Fact]
    public void Issuance_gates_are_readable_with_the_report_read_policy()
    {
        var method = typeof(ValuationApi::RealEstateEval.Valuation.Api.Controllers.ValuationRequestsController)
            .GetMethod("GetIssuanceGates")!;

        var policies = method.GetCustomAttributes<AuthorizeAttribute>().Select(a => a.Policy).ToList();

        Assert.Equal([CapabilityPolicyNames.ReadValuationReport], policies);
    }

    [Fact]
    public void The_alert_overrides_save_is_the_assigned_appraisers_write()
    {
        var method = typeof(ValuationApi::RealEstateEval.Valuation.Api.Controllers.ValuationReconciliationController)
            .GetMethod("SaveAlertOverrides")!;

        Assert.Equal(
            [CapabilityPolicyNames.SubmitValuationReport],
            method.GetCustomAttributes<AuthorizeAttribute>().Select(a => a.Policy).ToList());
        Assert.Contains(
            method.GetCustomAttributes(inherit: true),
            a => a.GetType().Name == "RequireAssignedAppraiserAttribute");
    }
}
