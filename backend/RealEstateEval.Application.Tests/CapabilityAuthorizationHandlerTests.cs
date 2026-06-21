using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using RealEstateEval.Application.Authorization;
using RealEstateEval.Shared.Web.Authorization;

namespace RealEstateEval.Application.Tests;

public class CapabilityAuthorizationHandlerTests
{
    private readonly CapabilityAuthorizationHandler _handler = new();

    [Fact]
    public async Task Succeeds_when_capability_claim_present()
    {
        var user = new ClaimsPrincipal(new ClaimsIdentity(
        [
            new Claim(PlatformCapabilities.ClaimType, PlatformCapabilities.ManageUsers),
        ],
        authenticationType: "test"));

        var context = new AuthorizationHandlerContext(
            [new CapabilityRequirement(PlatformCapabilities.ManageUsers)],
            user,
            resource: null);

        await _handler.HandleAsync(context);

        Assert.True(context.HasSucceeded);
    }

    [Fact]
    public async Task Does_not_succeed_when_capability_claim_missing()
    {
        var user = new ClaimsPrincipal(new ClaimsIdentity([], authenticationType: "test"));

        var context = new AuthorizationHandlerContext(
            [new CapabilityRequirement(PlatformCapabilities.ManageSystemConfig)],
            user,
            resource: null);

        await _handler.HandleAsync(context);

        Assert.False(context.HasSucceeded);
    }
}
