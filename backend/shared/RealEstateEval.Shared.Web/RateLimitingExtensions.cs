using System.Globalization;
using System.Text.Json;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace RealEstateEval.Shared.Web;

/// <summary>Fixed-window budget for one class of traffic.</summary>
public sealed class RateLimitWindowOptions
{
    public int PermitLimit { get; init; }

    public int WindowSeconds { get; init; }

    public int QueueLimit { get; init; }

    public TimeSpan Window => TimeSpan.FromSeconds(WindowSeconds);
}

/// <summary>
/// Request throttling budgets, bound from the <c>RateLimiting</c> configuration section.
/// Authentication endpoints get a much smaller budget than the rest of the API so that
/// credential stuffing runs out of attempts long before it runs out of usernames.
/// </summary>
public sealed class RateLimitingOptions
{
    public const string SectionName = "RateLimiting";

    private static readonly string[] DefaultAuthPathPrefixes =
    [
        "/api/auth/login",
        "/api/auth/login-username",
        "/api/auth/refresh",
        "/api/auth/dev-login-users",
        "/api/auth/activate",
    ];

 /// <summary>Container healthchecks and post-deploy smoke checks poll these.</summary>
    private static readonly string[] DefaultExemptPathPrefixes = ["/health", "/ready"];

    public bool Enabled { get; init; } = true;

    public RateLimitWindowOptions Global { get; init; } = new();

    public RateLimitWindowOptions Auth { get; init; } = new();

    public IReadOnlyList<string> AuthPathPrefixes { get; init; } = DefaultAuthPathPrefixes;

    public IReadOnlyList<string> ExemptPathPrefixes { get; init; } = DefaultExemptPathPrefixes;

 /// <summary>
 /// Single-value header carrying the caller's address as resolved by the ingress proxy.
 /// nginx sets it, and the gateway overwrites it for downstream services, so a service
 /// never has to guess how many proxy hops are in front of it.
 /// </summary>
    public string ClientAddressHeaderName { get; init; } =
        ClientAddressResolver.DefaultClientAddressHeaderName;

 /// <summary>
 /// Fallback for callers that arrive without <see cref="ClientAddressHeaderName"/>.
 /// </summary>
    public bool TrustForwardedForHeader { get; init; } = true;

    public string ForwardedForHeaderName { get; init; } = "X-Forwarded-For";

    public static RateLimitingOptions FromConfiguration(
        IConfiguration configuration,
        IHostEnvironment environment)
    {
        var section = configuration.GetSection(SectionName);
        var isDevelopment = environment.IsDevelopment();

        var options = new RateLimitingOptions
        {
            Enabled = section.GetValue("Enabled", true),
 // Development shares one loopback partition for the whole machine: the Next.js
 // dev proxy and the Playwright suite all reach the gateway from 127.0.0.1, so the
 // budgets there are wide enough to stay out of the way.
            Global = ReadWindow(
                section.GetSection("Global"),
                defaultPermitLimit: isDevelopment ? 10_000 : 600),
            Auth = ReadWindow(
                section.GetSection("Auth"),
                defaultPermitLimit: isDevelopment ? 1_000 : 10),
            AuthPathPrefixes = ReadPathPrefixes(
                section.GetSection("AuthPathPrefixes"),
                DefaultAuthPathPrefixes),
            ExemptPathPrefixes = ReadPathPrefixes(
                section.GetSection("ExemptPathPrefixes"),
                DefaultExemptPathPrefixes),
            ClientAddressHeaderName = ReadHeaderName(
                section,
                "ClientAddressHeaderName",
                ClientAddressResolver.DefaultClientAddressHeaderName),
            TrustForwardedForHeader = section.GetValue("TrustForwardedForHeader", true),
            ForwardedForHeaderName = ReadHeaderName(
                section,
                "ForwardedForHeaderName",
                "X-Forwarded-For"),
        };

        options.Validate();
        return options;
    }

    public void Validate()
    {
        ValidateWindow(Global, "Global");
        ValidateWindow(Auth, "Auth");

        if (string.IsNullOrWhiteSpace(ForwardedForHeaderName)
            || string.IsNullOrWhiteSpace(ClientAddressHeaderName))
        {
            throw new InvalidOperationException(
                $"{SectionName} header names must not be empty.");
        }
    }

    private static void ValidateWindow(RateLimitWindowOptions window, string name)
    {
        if (window.PermitLimit < 1)
        {
            throw new InvalidOperationException(
                $"{SectionName}:{name}:PermitLimit must be at least 1.");
        }

        if (window.WindowSeconds is < 1 or > 3600)
        {
            throw new InvalidOperationException(
                $"{SectionName}:{name}:WindowSeconds must be between 1 and 3600.");
        }

        if (window.QueueLimit is < 0 or > 1000)
        {
            throw new InvalidOperationException(
                $"{SectionName}:{name}:QueueLimit must be between 0 and 1000.");
        }
    }

    private static RateLimitWindowOptions ReadWindow(
        IConfiguration section,
        int defaultPermitLimit) => new()
        {
            PermitLimit = section.GetValue("PermitLimit", defaultPermitLimit),
            WindowSeconds = section.GetValue("WindowSeconds", 60),
            QueueLimit = section.GetValue("QueueLimit", 0),
        };

    private static string ReadHeaderName(IConfiguration section, string key, string fallback)
    {
        var configured = section[key];
        return string.IsNullOrWhiteSpace(configured) ? fallback : configured.Trim();
    }

    private static IReadOnlyList<string> ReadPathPrefixes(
        IConfiguration section,
        string[] fallback)
    {
        var configured = section.Get<string[]>();
        var source = configured is { Length: > 0 } ? configured : fallback;

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

public static class RateLimitingExtensions
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

 /// <summary>
 /// Registers a single global partitioned limiter: exempt paths pass through, authentication
 /// paths draw on the strict per-client budget, everything else on the default budget.
 /// Partitioning centrally (instead of per-endpoint attributes) keeps every service throttled
 /// by the shared pipeline without touching controllers.
 /// </summary>
    public static IServiceCollection AddRealEstateEvalRateLimiting(
        this IServiceCollection services,
        IConfiguration configuration,
        IHostEnvironment environment)
    {
        var options = RateLimitingOptions.FromConfiguration(configuration, environment);

 // Registered even when disabled so the pipeline can tell "off" from "not configured".
        services.AddSingleton(options);

        if (!options.Enabled)
            return services;

        var authPrefixes = ToPathStrings(options.AuthPathPrefixes);
        var exemptPrefixes = ToPathStrings(options.ExemptPathPrefixes);

        services.AddRateLimiter(limiter =>
        {
            limiter.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            limiter.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(
                context => Partition(context, options, authPrefixes, exemptPrefixes));
            limiter.OnRejected = (context, cancellationToken) =>
                WriteProblemDetailsAsync(context, options, authPrefixes, cancellationToken);
        });

        return services;
    }

 /// <summary>No-op when rate limiting is disabled or was never registered.</summary>
    public static WebApplication UseRealEstateEvalRateLimiter(this WebApplication app)
    {
        if (app.Services.GetService<RateLimitingOptions>() is { Enabled: true })
            app.UseRateLimiter();

        return app;
    }

    private static RateLimitPartition<string> Partition(
        HttpContext context,
        RateLimitingOptions options,
        PathString[] authPrefixes,
        PathString[] exemptPrefixes)
    {
        var path = context.Request.Path;

        if (MatchesPrefix(path, exemptPrefixes))
            return RateLimitPartition.GetNoLimiter("exempt");

        var clientKey = ClientAddressResolver.Resolve(context, options) ?? "unknown";

 // CORS preflight is not a credential attempt; keep it off the strict budget.
        if (!HttpMethods.IsOptions(context.Request.Method) && MatchesPrefix(path, authPrefixes))
            return FixedWindow($"auth|{clientKey}", options.Auth);

        return FixedWindow($"global|{clientKey}", options.Global);
    }

    private static RateLimitPartition<string> FixedWindow(
        string partitionKey,
        RateLimitWindowOptions window) =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey,
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = window.PermitLimit,
                Window = window.Window,
                QueueLimit = window.QueueLimit,
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                AutoReplenishment = true,
            });

    private static bool MatchesPrefix(PathString path, PathString[] prefixes)
    {
        foreach (var prefix in prefixes)
        {
            if (path.StartsWithSegments(prefix, StringComparison.OrdinalIgnoreCase))
                return true;
        }

        return false;
    }

    private static PathString[] ToPathStrings(IReadOnlyList<string> prefixes)
    {
        var result = new PathString[prefixes.Count];
        for (var i = 0; i < prefixes.Count; i++)
            result[i] = new PathString(prefixes[i]);

        return result;
    }

    private static async ValueTask WriteProblemDetailsAsync(
        OnRejectedContext context,
        RateLimitingOptions options,
        PathString[] authPrefixes,
        CancellationToken cancellationToken)
    {
        var httpContext = context.HttpContext;
        if (httpContext.Response.HasStarted)
            return;

        var retryAfterSeconds =
            context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter)
                ? (int)Math.Ceiling(retryAfter.TotalSeconds)
                : MatchesPrefix(httpContext.Request.Path, authPrefixes)
                    ? options.Auth.WindowSeconds
                    : options.Global.WindowSeconds;

        httpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        httpContext.Response.ContentType = "application/problem+json";
        httpContext.Response.Headers.RetryAfter =
            retryAfterSeconds.ToString(CultureInfo.InvariantCulture);

        var problem = new
        {
            type = "https://httpstatuses.com/429",
            title = "Too Many Requests",
            status = StatusCodes.Status429TooManyRequests,
            detail = $"Too many requests from this client. Retry after {retryAfterSeconds} seconds.",
            traceId = httpContext.TraceIdentifier,
        };

        await httpContext.Response.WriteAsync(
            JsonSerializer.Serialize(problem, JsonOptions),
            cancellationToken);
    }
}
