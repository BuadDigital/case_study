using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace RealEstateEval.Shared.Web;

/// <summary>
/// Restricts owner-to-owner dispatch routes. UpstreamJson always sends
/// <see cref="HeaderName"/>; browser clients hitting the gateway must not.
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public sealed class RequireUpstreamDispatchAttribute : Attribute, IAuthorizationFilter
{
    public const string HeaderName = "X-REE-Upstream";
    public const string HeaderValue = "1";

    public void OnAuthorization(AuthorizationFilterContext context)
    {
        if (context.HttpContext.Request.Headers.TryGetValue(HeaderName, out var values)
            && values.Any(v => string.Equals(v, HeaderValue, StringComparison.Ordinal)))
        {
            return;
        }

        context.Result = new ForbidResult();
    }
}
