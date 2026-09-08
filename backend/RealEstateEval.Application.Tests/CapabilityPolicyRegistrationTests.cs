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
                     CapabilityPolicyNames.ManagePartyFeePricing,
                     CapabilityPolicyNames.ReadCaseStudyWorkspace,
                     CapabilityPolicyNames.ReadAttachments,
                     CapabilityPolicyNames.ReadIdentityDirectory,
                     CapabilityPolicyNames.ReadPartyPayables,
                     CapabilityPolicyNames.ReadInspectionContext,
                 })
        {
            Assert.NotNull(await policyProvider.GetPolicyAsync(composite));
        }
    }

    [Fact]
    public async Task Case_staff_and_parties_read_the_case_study_workspace()
    {
        var authorization = BuildAuthorizationService();

        Assert.True((await authorization.AuthorizeAsync(
            PrincipalWith(PlatformCapabilities.ManageWorkOrders),
            resource: null,
            CapabilityPolicyNames.ReadCaseStudyWorkspace)).Succeeded);
        Assert.True((await authorization.AuthorizeAsync(
            PrincipalWith(PlatformCapabilities.SubmitPartyWork),
            resource: null,
            CapabilityPolicyNames.ReadCaseStudyWorkspace)).Succeeded);
        Assert.False((await authorization.AuthorizeAsync(
            PrincipalWith(PlatformCapabilities.ManageFinancial),
            resource: null,
            CapabilityPolicyNames.ReadCaseStudyWorkspace)).Succeeded);
    }

    [Fact]
    public async Task Attachment_readers_cover_operational_and_party_caps()
    {
        var authorization = BuildAuthorizationService();

        Assert.True((await authorization.AuthorizeAsync(
            PrincipalWith(PlatformCapabilities.SubmitPartyWork),
            resource: null,
            CapabilityPolicyNames.ReadAttachments)).Succeeded);
        Assert.True((await authorization.AuthorizeAsync(
            PrincipalWith(PlatformCapabilities.ManageWorkOrders),
            resource: null,
            CapabilityPolicyNames.ReadAttachments)).Succeeded);
        Assert.False((await authorization.AuthorizeAsync(
            PrincipalWith(PlatformCapabilities.ManageUsers),
            resource: null,
            CapabilityPolicyNames.ReadAttachments)).Succeeded);
    }

    [Fact]
    public async Task Party_payables_and_inspection_context_composites()
    {
        var authorization = BuildAuthorizationService();

        Assert.True((await authorization.AuthorizeAsync(
            PrincipalWith(PlatformCapabilities.SubmitPartyWork),
            resource: null,
            CapabilityPolicyNames.ReadPartyPayables)).Succeeded);
        Assert.True((await authorization.AuthorizeAsync(
            PrincipalWith(PlatformCapabilities.ManageFinancial),
            resource: null,
            CapabilityPolicyNames.ReadPartyPayables)).Succeeded);
        Assert.False((await authorization.AuthorizeAsync(
            PrincipalWith(PlatformCapabilities.ManageAttachments),
            resource: null,
            CapabilityPolicyNames.ReadPartyPayables)).Succeeded);

        Assert.True((await authorization.AuthorizeAsync(
            PrincipalWith(PlatformCapabilities.SubmitValuationReport),
            resource: null,
            CapabilityPolicyNames.ReadInspectionContext)).Succeeded);
        Assert.False((await authorization.AuthorizeAsync(
            PrincipalWith(PlatformCapabilities.ManageFinancial),
            resource: null,
            CapabilityPolicyNames.ReadInspectionContext)).Succeeded);
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
