using Microsoft.AspNetCore.Http;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Authorization;
using RealEstateEval.CaseStudy.Application.Abstractions;

namespace RealEstateEval.CaseStudy.Infrastructure.Services;

/// <summary>Resolves the request user's prototype role from the HTTP principal + permissions.</summary>
public sealed class HttpCurrentPrototypeRoleResolver(
    IHttpContextAccessor httpContextAccessor,
    IPermissionService permissions) : ICurrentPrototypeRoleResolver
{
    public async Task<string?> ResolveAsync(CancellationToken cancellationToken)
    {
        var userId = ActorIdentity.TryUserId(httpContextAccessor.HttpContext?.User);
        if (string.IsNullOrWhiteSpace(userId)) return null;
        var perms = await permissions.GetForUserIdAsync(userId, cancellationToken);
        return perms?.PrototypeRole;
    }
}
