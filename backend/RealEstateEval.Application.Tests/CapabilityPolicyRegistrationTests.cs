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
    }
}
