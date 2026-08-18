using System.Diagnostics;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;

namespace RealEstateEval.Shared.Web;

/// <summary>
/// Flows a correlation id through response headers, log scopes, and the current trace.
/// A caller-supplied <c>X-Correlation-Id</c> is echoed back and written into logs, so it is
/// only trusted when it looks like an id; anything else is replaced with a fresh value.
/// </summary>
public sealed class CorrelationIdMiddleware
{
    public const string HeaderName = "X-Correlation-Id";

 /// <summary>Long enough for a GUID, a W3C trace id, or a caller's own request id.</summary>
    public const int MaxLength = 128;

    public const string LogScopeKey = "CorrelationId";
    private const string ActivityTagName = "correlation.id";

    private readonly RequestDelegate _next;
    private readonly ILogger<CorrelationIdMiddleware> _logger;
    private readonly ObservabilityLabels _labels;

    public CorrelationIdMiddleware(
        RequestDelegate next,
        ILogger<CorrelationIdMiddleware> logger,
        ObservabilityLabels labels)
    {
        _next = next;
        _logger = logger;
        _labels = labels;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var supplied = context.Request.Headers[HeaderName];
        var correlationId = supplied.Count == 1 ? Sanitize(supplied[0]) : null;

        if (correlationId is null)
        {
            if (supplied.Count > 0)
            {
                _logger.LogWarning(
                    "Ignored an unusable {HeaderName} header on {Method} {Path}; issued a new correlation id.",
                    HeaderName,
                    context.Request.Method,
                    context.Request.Path.Value);
            }

            correlationId = Guid.NewGuid().ToString("N");
        }

        context.TraceIdentifier = correlationId;
        context.Response.Headers[HeaderName] = correlationId;
        Activity.Current?.SetTag(ActivityTagName, correlationId);

        using (_logger.BeginScope(
            new Dictionary<string, object>
            {
                [LogScopeKey] = correlationId,
                ["Service"] = _labels.ServiceName,
            }))
        {
            await _next(context);
        }
    }

 /// <summary>
 /// Returns the id to use, or <c>null</c> when the candidate cannot be safely echoed
 /// (header injection, log forging, or unbounded growth of an indexed log field).
 /// </summary>
    public static string? Sanitize(string? candidate)
    {
        if (string.IsNullOrWhiteSpace(candidate))
            return null;

        var trimmed = candidate.Trim();
        if (trimmed.Length > MaxLength)
            return null;

        foreach (var character in trimmed)
        {
            var allowed = char.IsAsciiLetterOrDigit(character)
                || character is '-' or '_' or '.' or ':';
            if (!allowed)
                return null;
        }

        return trimmed;
    }
}

public static class CorrelationIdMiddlewareExtensions
{
    public static IApplicationBuilder UseCorrelationId(this IApplicationBuilder app) =>
        app.UseMiddleware<CorrelationIdMiddleware>();
}
