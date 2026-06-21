using Microsoft.AspNetCore.Authorization;
using RealEstateEval.Application.Authorization;

namespace RealEstateEval.Shared.Web.Authorization;

/// <summary>Requires a <c>capability</c> claim issued at login.</summary>
public sealed class CapabilityAuthorizationHandler : AuthorizationHandler<CapabilityRequirement>
{
    public const string ClaimType = PlatformCapabilities.ClaimType;

    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        CapabilityRequirement requirement)
    {
        if (context.User.HasClaim(ClaimType, requirement.Capability))
            context.Succeed(requirement);

        return Task.CompletedTask;
    }
}
