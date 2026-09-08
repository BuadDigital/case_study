using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace RealEstateEval.Shared.Web;

/// <summary>
/// Restricts owner-to-owner dispatch routes. UpstreamJson always sends
/// <see cref="HeaderName"/> on service-to-service calls. The public gateway and nginx strip
/// this header from browser traffic so forging it at the edge does not open these routes.
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
