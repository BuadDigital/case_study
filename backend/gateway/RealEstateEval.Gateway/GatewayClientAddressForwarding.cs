using RealEstateEval.Shared.Web;
using Yarp.ReverseProxy.Transforms;

namespace RealEstateEval.Gateway;

public static class GatewayClientAddressForwarding
{
 /// <summary>
 /// Overwrites the client-address header on every proxied request with the caller the gateway
 /// resolved, so downstream services throttle per caller without counting proxy hops (and so a
 /// caller-supplied value can never survive the gateway).
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

            return default;
        }));
}
