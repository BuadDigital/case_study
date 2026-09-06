using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.DependencyInjection;
using RealEstateEval.Application.Authorization;
using RealEstateEval.Shared.Web;
using RealEstateEval.Shared.Web.Authorization;

namespace RealEstateEval.Application.Tests;

public class CapabilityPolicyRegistrationTests
{
    [Fact]
    public async Task Every_platform_capability_has_registered_policy()
    {
        var services = new ServiceCollection();
        services.AddRealEstateEvalCapabilityAuthorization();
        var provider = services.BuildServiceProvider();
        var policyProvider = provider.GetRequiredService<IAuthorizationPolicyProvider>();

        foreach (var capability in PlatformCapabilities.All)
        {
            var policy = await policyProvider.GetPolicyAsync(CapabilityPolicyNames.For(capability));
            Assert.NotNull(policy);
        }

        foreach (var composite in new[]
                 {
                     CapabilityPolicyNames.RaiseFailures,
                     CapabilityPolicyNames.ReadFinancialData,
                     CapabilityPolicyNames.ReadManagementReports,
                     CapabilityPolicyNames.ReadKeyData,
                     CapabilityPolicyNames.ReadValuationQueue,
                     CapabilityPolicyNames.ReadValuationReport,
                     CapabilityPolicyNames.WriteComparableBank,
                     CapabilityPolicyNames.ReadComparableBank,
                     CapabilityPolicyNames.ListDistributionAssignees,
                 })
        {
            Assert.NotNull(await policyProvider.GetPolicyAsync(composite));
        }
    }

    /// <summary>
    /// The case specialist holds manage-work-orders and no valuation capability. She reads the
    /// property's valuation report but never the queue that gate protects.
    /// </summary>
    [Fact]
    public async Task Case_staff_read_the_valuation_report_but_not_the_queue()
    {
        var authorization = BuildAuthorizationService();
        var caseStaff = PrincipalWith(PlatformCapabilities.ManageWorkOrders);

        var report = await authorization.AuthorizeAsync(
            caseStaff, resource: null, CapabilityPolicyNames.ReadValuationReport);
        var queue = await authorization.AuthorizeAsync(
            caseStaff, resource: null, CapabilityPolicyNames.ReadValuationQueue);

        Assert.True(report.Succeeded);
        Assert.False(queue.Succeeded);
    }

    [Theory]
    [InlineData(PlatformCapabilities.ManageValuationRequests)]
    [InlineData(PlatformCapabilities.SubmitValuationReport)]
    public async Task Valuation_roles_keep_reading_the_report(string capability)
    {
        var authorization = BuildAuthorizationService();

        var result = await authorization.AuthorizeAsync(
            PrincipalWith(capability), resource: null, CapabilityPolicyNames.ReadValuationReport);

        Assert.True(result.Succeeded);
    }

    [Fact]
    public async Task Field_parties_do_not_read_the_valuation_report()
    {
        var authorization = BuildAuthorizationService();
        var party = PrincipalWith(
            PlatformCapabilities.SubmitPartyWork,
            PlatformCapabilities.ManageAttachments);

        var result = await authorization.AuthorizeAsync(
            party, resource: null, CapabilityPolicyNames.ReadValuationReport);

        Assert.False(result.Succeeded);
    }

    private static IAuthorizationService BuildAuthorizationService()
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddRealEstateEvalCapabilityAuthorization();
        return services.BuildServiceProvider().GetRequiredService<IAuthorizationService>();
    }

    private static ClaimsPrincipal PrincipalWith(params string[] capabilities) =>
        new(new ClaimsIdentity(
            capabilities.Select(c => new Claim(PlatformCapabilities.ClaimType, c)),
            authenticationType: "test"));
}
