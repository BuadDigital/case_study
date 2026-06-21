using Microsoft.AspNetCore.Authorization;

namespace RealEstateEval.Shared.Web.Authorization;

public sealed class CapabilityRequirement(string capability) : IAuthorizationRequirement
{
    public string Capability { get; } = capability;
}
