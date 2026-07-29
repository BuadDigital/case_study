using System.Globalization;
using System.Text;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;

namespace RealEstateEval.Shared.Web.Middleware;

/// <summary>
/// Response hardening headers, bound from the <c>SecurityHeaders</c> configuration section.
/// </summary>
public sealed class SecurityHeadersOptions
{
    public const string SectionName = "SecurityHeaders";

    /// <summary>
    /// API responses are JSON and are never meant to execute or embed anything, so everything
    /// is denied. Swagger UI gets <see cref="DefaultDocumentationContentSecurityPolicy"/>.
    /// </summary>
    public const string DefaultContentSecurityPolicy =
        "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";

    /// <summary>
    /// Swagger UI needs a policy of its own: it loads scripts and stylesheets as same-origin
    /// files (so <c>'self'</c> is enough for scripts), but its React components set inline
    /// <c>style</c> attributes, which <c>style-src</c> governs. Enabling Swagger's OAuth2
    /// redirect page would additionally need inline script allowed here.
    /// </summary>
    public const string DefaultDocumentationContentSecurityPolicy =
        "default-src 'self'; "
        + "script-src 'self'; "
        + "style-src 'self' 'unsafe-inline'; "
        + "img-src 'self' data:; "
        + "font-src 'self' data:; "
        + "connect-src 'self'; "
        + "frame-ancestors 'none'; "
        + "base-uri 'self'; "
        + "form-action 'self'";

    public const string DefaultPermissionsPolicy =
        "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), "
        + "microphone=(), payment=(), usb=()";

    private static readonly string[] DefaultDocumentationPathPrefixes = ["/swagger"];

    public bool Enabled { get; init; } = true;

    public string ContentSecurityPolicy { get; init; } = DefaultContentSecurityPolicy;

    public string DocumentationContentSecurityPolicy { get; init; } =
        DefaultDocumentationContentSecurityPolicy;

    public IReadOnlyList<string> DocumentationPathPrefixes { get; init; } =
        DefaultDocumentationPathPrefixes;

    public string FrameOptions { get; init; } = "DENY";

    public string ReferrerPolicy { get; init; } = "no-referrer";

    public string PermissionsPolicy { get; init; } = DefaultPermissionsPolicy;

    /// <summary>Defaults to on outside Development; only emitted on HTTPS requests.</summary>
    public bool EnableHsts { get; init; }

    public int HstsMaxAgeSeconds { get; init; } = 31_536_000;

    public bool HstsIncludeSubDomains { get; init; } = true;

    public bool HstsPreload { get; init; }

    /// <summary>
    /// TLS terminates at the ingress proxy, which forwards plain HTTP with
    /// <c>X-Forwarded-Proto</c>. Without honouring it HSTS would never be emitted.
    /// </summary>
    public bool TrustForwardedProtoHeader { get; init; } = true;

    public static SecurityHeadersOptions FromConfiguration(
        IConfiguration configuration,
        IHostEnvironment environment)
    {
        var section = configuration.GetSection(SectionName);
        var hsts = section.GetSection("Hsts");

        var options = new SecurityHeadersOptions
        {
            Enabled = section.GetValue("Enabled", true),
            ContentSecurityPolicy = ReadPolicy(
                section["ContentSecurityPolicy"],
                DefaultContentSecurityPolicy),
            DocumentationContentSecurityPolicy = ReadPolicy(
                section["DocumentationContentSecurityPolicy"],
                DefaultDocumentationContentSecurityPolicy),
            DocumentationPathPrefixes = ReadPathPrefixes(
                section.GetSection("DocumentationPathPrefixes")),
            FrameOptions = ReadPolicy(section["FrameOptions"], "DENY"),
            ReferrerPolicy = ReadPolicy(section["ReferrerPolicy"], "no-referrer"),
            PermissionsPolicy = ReadPolicy(section["PermissionsPolicy"], DefaultPermissionsPolicy),
            EnableHsts = hsts.GetValue("Enabled", !environment.IsDevelopment()),
            HstsMaxAgeSeconds = hsts.GetValue("MaxAgeSeconds", 31_536_000),
            HstsIncludeSubDomains = hsts.GetValue("IncludeSubDomains", true),
            HstsPreload = hsts.GetValue("Preload", false),
            TrustForwardedProtoHeader = section.GetValue("TrustForwardedProtoHeader", true),
        };

        options.Validate();
        return options;
    }

    public void Validate()
    {
        if (HstsMaxAgeSeconds < 0)
        {
            throw new InvalidOperationException(
                $"{SectionName}:Hsts:MaxAgeSeconds must not be negative.");
        }

        if (EnableHsts && HstsPreload && !HstsIncludeSubDomains)
        {
            throw new InvalidOperationException(
                $"{SectionName}:Hsts:Preload requires IncludeSubDomains.");
        }
    }

    public string BuildStrictTransportSecurity()
    {
        var builder = new StringBuilder("max-age=")
            .Append(HstsMaxAgeSeconds.ToString(CultureInfo.InvariantCulture));

        if (HstsIncludeSubDomains)
            builder.Append("; includeSubDomains");

        if (HstsPreload)
            builder.Append("; preload");

        return builder.ToString();
    }

    private static string ReadPolicy(string? configured, string fallback) =>
        configured is null ? fallback : configured.Trim();

    private static IReadOnlyList<string> ReadPathPrefixes(IConfiguration section)
    {
        var configured = section.Get<string[]>();
        var source = configured is { Length: > 0 }
            ? configured
            : DefaultDocumentationPathPrefixes;

        var prefixes = new List<string>(source.Length);
        foreach (var entry in source)
        {
            if (string.IsNullOrWhiteSpace(entry))
                continue;

            var normalized = entry.Trim().TrimEnd('/');
            if (!normalized.StartsWith('/'))
                normalized = "/" + normalized;

            prefixes.Add(normalized);
        }

        return prefixes;
    }
}

public sealed class SecurityHeadersMiddleware
{
    private static readonly Func<object, Task> ApplyHeadersCallback = static state =>
    {
        var (middleware, context) = ((SecurityHeadersMiddleware, HttpContext))state;
        middleware.ApplyHeaders(context);
        return Task.CompletedTask;
    };

    private readonly RequestDelegate _next;
    private readonly SecurityHeadersOptions _options;
    private readonly PathString[] _documentationPrefixes;

    public SecurityHeadersMiddleware(RequestDelegate next, SecurityHeadersOptions options)
    {
        _next = next;
        _options = options;
        _documentationPrefixes = options.DocumentationPathPrefixes
            .Select(prefix => new PathString(prefix))
            .ToArray();
    }

    public Task InvokeAsync(HttpContext context)
    {
        // Applied on first write: GlobalExceptionHandlerMiddleware calls Response.Clear() when
        // it converts an exception into problem details, which would drop headers set earlier.
        context.Response.OnStarting(ApplyHeadersCallback, (this, context));
        return _next(context);
    }

    private void ApplyHeaders(HttpContext context)
    {
        var headers = context.Response.Headers;

        headers.XContentTypeOptions = "nosniff";

        if (_options.FrameOptions.Length > 0)
            headers.XFrameOptions = _options.FrameOptions;

        if (_options.ReferrerPolicy.Length > 0)
            headers["Referrer-Policy"] = _options.ReferrerPolicy;

        if (_options.PermissionsPolicy.Length > 0)
            headers["Permissions-Policy"] = _options.PermissionsPolicy;

        var policy = IsDocumentationRequest(context.Request.Path)
            ? _options.DocumentationContentSecurityPolicy
            : _options.ContentSecurityPolicy;

        if (policy.Length > 0)
            headers.ContentSecurityPolicy = policy;

        if (_options.EnableHsts && IsHttps(context))
            headers.StrictTransportSecurity = _options.BuildStrictTransportSecurity();
    }

    private bool IsDocumentationRequest(PathString path)
    {
        foreach (var prefix in _documentationPrefixes)
        {
            if (path.StartsWithSegments(prefix, StringComparison.OrdinalIgnoreCase))
                return true;
        }

        return false;
    }

    private bool IsHttps(HttpContext context)
    {
        if (context.Request.IsHttps)
            return true;

        if (!_options.TrustForwardedProtoHeader)
            return false;

        return context.Request.Headers.TryGetValue("X-Forwarded-Proto", out var proto)
            && proto.ToString()
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Any(value => string.Equals(value, "https", StringComparison.OrdinalIgnoreCase));
    }
}

public static class SecurityHeadersExtensions
{
    public static WebApplication UseRealEstateEvalSecurityHeaders(this WebApplication app)
    {
        var options = SecurityHeadersOptions.FromConfiguration(app.Configuration, app.Environment);
        if (!options.Enabled)
            return app;

        app.UseMiddleware<SecurityHeadersMiddleware>(options);
        return app;
    }
}
