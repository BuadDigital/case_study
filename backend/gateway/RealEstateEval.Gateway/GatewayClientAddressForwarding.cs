using RealEstateEval.Shared.Web;
using Yarp.ReverseProxy.Transforms;

namespace RealEstateEval.Gateway;

public static class GatewayClientAddressForwarding
{
 /// <summary>
/// Overwrites the client-address header on every proxied request with the caller the gateway
/// resolved, so downstream services throttle per caller without counting proxy hops (and so a
/// caller-supplied value can never survive the gateway). Also strips
/// <see cref="RequireUpstreamDispatchAttribute.HeaderName"/> so browsers cannot forge
/// owner-to-owner dispatch routes.
/// </summary>
    public static IReverseProxyBuilder AddRealEstateEvalClientAddressForwarding(
        this IReverseProxyBuilder builder) =>
        builder.AddTransforms(context => context.AddRequestTransform(transform =>
        {
            var options = transform.HttpContext.RequestServices
                .GetRequiredService<RateLimitingOptions>();
            var headerName = options.ClientAddressHeaderName;

            transform.ProxyRequest.Headers.Remove(headerName);

            var clientAddress = ClientAddressResolver.Resolve(transform.HttpContext, options);
            if (clientAddress is not null)
                transform.ProxyRequest.Headers.TryAddWithoutValidation(headerName, clientAddress);

            CorrelationIdForwarding.Overwrite(
                transform.ProxyRequest.Headers,
                transform.HttpContext.TraceIdentifier);

            // Browser clients must never forge owner-to-owner dispatch. Services call each
            // other directly (not via this gateway) and set X-REE-Upstream themselves.
            transform.ProxyRequest.Headers.Remove(RequireUpstreamDispatchAttribute.HeaderName);

            return default;
        }));
}
