using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace RealEstateEval.Shared.Web;

/// <summary>
/// Browser origins allowed to call the API, bound from the <c>Cors</c> configuration section.
/// Development additionally allows any host on the Next.js dev ports; outside Development the
/// list is the only source of truth.
/// </summary>
public sealed class RealEstateEvalCorsOptions
{
    public const string SectionName = "Cors";

    public IReadOnlyList<string> AllowedOrigins { get; init; } = [];

    public bool AllowCredentials { get; init; }

    /// <summary>
    /// Opt-in fail-fast: when set, a deployment outside Development that lists no origins
    /// refuses to start instead of starting with cross-origin access denied.
    /// </summary>
    public bool RequireAllowedOrigins { get; init; }

    /// <summary>True when the process should shout about an empty list at startup.</summary>
    public bool WarnOnMissingOrigins { get; init; }

    public static RealEstateEvalCorsOptions FromConfiguration(
        IConfiguration configuration,
        IHostEnvironment environment)
    {
        var section = configuration.GetSection(SectionName);
        var origins = NormalizeOrigins(section.GetSection("AllowedOrigins").Get<string[]>());
        var allowCredentials = section.GetValue("AllowCredentials", false);
        var requireAllowedOrigins = section.GetValue("RequireAllowedOrigins", false);
        var isDevelopment = environment.IsDevelopment();

        if (origins.Count == 0 && !isDevelopment && requireAllowedOrigins)
        {
            throw new InvalidOperationException(
                $"{SectionName}:AllowedOrigins must list at least one origin in the "
                + $"{environment.EnvironmentName} environment when "
                + $"{SectionName}:RequireAllowedOrigins is enabled.");
        }

        return new RealEstateEvalCorsOptions
        {
            AllowedOrigins = origins,
            AllowCredentials = allowCredentials,
            RequireAllowedOrigins = requireAllowedOrigins,
            WarnOnMissingOrigins = origins.Count == 0 && !isDevelopment,
        };
    }

    private static IReadOnlyList<string> NormalizeOrigins(string[]? configured)
    {
        if (configured is null or { Length: 0 })
            return [];

        var origins = new List<string>(configured.Length);
        foreach (var entry in configured)
        {
            if (string.IsNullOrWhiteSpace(entry))
                continue;

            var candidate = entry.Trim();

            // AllowAnyOrigin is never acceptable here: the API is credential-bearing and a
            // wildcard cannot be combined with credentials at all.
            if (candidate == "*")
            {
                throw new InvalidOperationException(
                    $"{SectionName}:AllowedOrigins must not contain '*'. List explicit origins.");
            }

            if (!Uri.TryCreate(candidate, UriKind.Absolute, out var uri)
                || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps)
                || !string.IsNullOrEmpty(uri.Query)
                || uri.AbsolutePath != "/")
            {
                throw new InvalidOperationException(
                    $"{SectionName}:AllowedOrigins entry '{candidate}' is not a scheme://host[:port] origin.");
            }

            var normalized = uri.GetLeftPart(UriPartial.Authority);
            if (!origins.Contains(normalized, StringComparer.OrdinalIgnoreCase))
                origins.Add(normalized);
        }

        return origins;
    }
}

/// <summary>Startup log for a deployment that denies every cross-origin browser request.</summary>
internal sealed class MissingCorsOriginsAnnouncer : IHostedService
{
    private readonly ILogger<MissingCorsOriginsAnnouncer> _logger;
    private readonly IHostEnvironment _environment;

    public MissingCorsOriginsAnnouncer(
        ILogger<MissingCorsOriginsAnnouncer> logger,
        IHostEnvironment environment)
    {
        _logger = logger;
        _environment = environment;
    }

    public Task StartAsync(CancellationToken cancellationToken)
    {
        _logger.LogCritical(
            "No {Section}:AllowedOrigins configured for the {Environment} environment: every "
            + "cross-origin browser request will be rejected. This is correct only while the "
            + "frontend proxies the API through its own origin.",
            RealEstateEvalCorsOptions.SectionName,
            _environment.EnvironmentName);

        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
