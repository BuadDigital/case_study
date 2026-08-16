using System.Net;
using Microsoft.AspNetCore.Http;

namespace RealEstateEval.Shared.Web;

/// <summary>
/// Works out which address a request should be attributed to for per-client throttling.
/// <para>
/// Counting <c>X-Forwarded-For</c> entries is unreliable here because the number of proxies in
/// front of a process differs per deployment: nginx and the gateway each append the peer they
/// saw, so the right-most entry a service sees is nginx, not the caller. Instead the ingress
/// chain publishes the caller in a single-value header (nginx sets <c>X-Real-IP</c>; the gateway
/// overwrites it before forwarding), and that header wins whenever it is present.
/// </para>
/// </summary>
public static class ClientAddressResolver
{
    public const string DefaultClientAddressHeaderName = "X-Real-IP";

 /// <summary>Returns the normalized caller address, or null when it cannot be determined.</summary>
    public static string? Resolve(HttpContext context, RateLimitingOptions options)
    {
        if (context.Request.Headers.TryGetValue(options.ClientAddressHeaderName, out var declared)
            && TryNormalize(declared.ToString(), out var declaredAddress))
        {
            return declaredAddress;
        }

        if (options.TrustForwardedForHeader
            && context.Request.Headers.TryGetValue(
                options.ForwardedForHeaderName,
                out var forwarded))
        {
            var entries = forwarded.ToString().Split(
                ',',
                StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

 // Right-most entry is the closest proxy's view of its peer, which is the caller
 // whenever exactly one proxy is in front of this process.
            for (var i = entries.Length - 1; i >= 0; i--)
            {
                if (TryNormalize(entries[i], out var forwardedAddress))
                    return forwardedAddress;
            }
        }

        var remote = context.Connection.RemoteIpAddress;
        return remote is null ? null : Normalize(remote);
    }

    private static bool TryNormalize(string candidate, out string normalized)
    {
        normalized = string.Empty;
        candidate = candidate.Trim();
        if (candidate.Length == 0)
            return false;

        if (IPAddress.TryParse(candidate, out var parsed))
        {
            normalized = Normalize(parsed);
            return true;
        }

 // Some proxies append "host:port"; IPv6 literals arrive bracketed.
        var withoutPort = candidate;
        var separator = withoutPort.LastIndexOf(':');
        if (separator > 0)
            withoutPort = withoutPort[..separator];

        if (IPAddress.TryParse(withoutPort.Trim('[', ']'), out var parsedWithoutPort))
        {
            normalized = Normalize(parsedWithoutPort);
            return true;
        }

        return false;
    }

    private static string Normalize(IPAddress address) =>
        address.IsIPv4MappedToIPv6 ? address.MapToIPv4().ToString() : address.ToString();
}
