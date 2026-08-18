using System.Net.Http.Headers;
using Microsoft.AspNetCore.Http;

namespace RealEstateEval.Shared.Web;

/// <summary>
/// Copies the inbound request's correlation id onto outbound <see cref="HttpClient"/> calls
/// so owner-HTTP lookups share one id in logs and traces.
/// </summary>
public sealed class CorrelationIdDelegatingHandler(IHttpContextAccessor httpContextAccessor)
    : DelegatingHandler
{
    protected override Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request,
        CancellationToken cancellationToken)
    {
        CorrelationIdForwarding.TryAdd(
            request.Headers,
            httpContextAccessor.HttpContext?.TraceIdentifier);
        return base.SendAsync(request, cancellationToken);
    }
}

public static class CorrelationIdForwarding
{
    public static void TryAdd(HttpRequestHeaders headers, string? correlationId)
    {
        if (headers.Contains(CorrelationIdMiddleware.HeaderName))
            return;
        Write(headers, correlationId);
    }

    public static void Overwrite(HttpRequestHeaders headers, string? correlationId)
    {
        headers.Remove(CorrelationIdMiddleware.HeaderName);
        Write(headers, correlationId);
    }

    private static void Write(HttpRequestHeaders headers, string? correlationId)
    {
        var sanitized = CorrelationIdMiddleware.Sanitize(correlationId);
        if (sanitized is null)
            return;
        headers.TryAddWithoutValidation(CorrelationIdMiddleware.HeaderName, sanitized);
    }
}
