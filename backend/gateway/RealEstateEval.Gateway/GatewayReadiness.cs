using System.Diagnostics;
using Yarp.ReverseProxy;

namespace RealEstateEval.Gateway;

/// <summary>
/// Upstream readiness probe settings, bound from the <c>Gateway:Readiness</c> section.
/// </summary>
public sealed class GatewayReadinessOptions
{
    public const string SectionName = "Gateway:Readiness";

    public bool Enabled { get; init; } = true;

    public int TimeoutSeconds { get; init; } = 2;

    /// <summary>Container healthchecks poll frequently; results are reused for this long.</summary>
    public int CacheSeconds { get; init; } = 5;

    public string UpstreamHealthPath { get; init; } = "/health";

    /// <summary>Empty means every cluster configured in <c>ReverseProxy:Clusters</c>.</summary>
    public IReadOnlyList<string> RequiredClusters { get; init; } = [];

    public static GatewayReadinessOptions FromConfiguration(IConfiguration configuration)
    {
        var section = configuration.GetSection(SectionName);

        var options = new GatewayReadinessOptions
        {
            Enabled = section.GetValue("Enabled", true),
            TimeoutSeconds = section.GetValue("TimeoutSeconds", 2),
            CacheSeconds = section.GetValue("CacheSeconds", 5),
            UpstreamHealthPath = ReadHealthPath(section["UpstreamHealthPath"]),
            RequiredClusters = section.GetSection("RequiredClusters").Get<string[]>() ?? [],
        };

        options.Validate();
        return options;
    }

    public void Validate()
    {
        if (TimeoutSeconds is < 1 or > 30)
        {
            throw new InvalidOperationException(
                $"{SectionName}:TimeoutSeconds must be between 1 and 30.");
        }

        if (CacheSeconds is < 0 or > 300)
        {
            throw new InvalidOperationException(
                $"{SectionName}:CacheSeconds must be between 0 and 300.");
        }

        if (!UpstreamHealthPath.StartsWith('/'))
        {
            throw new InvalidOperationException(
                $"{SectionName}:UpstreamHealthPath must start with '/'.");
        }
    }

    private static string ReadHealthPath(string? configured)
    {
        if (string.IsNullOrWhiteSpace(configured))
            return "/health";

        var trimmed = configured.Trim();
        return trimmed.StartsWith('/') ? trimmed : "/" + trimmed;
    }
}

public sealed record GatewayReadinessSnapshot(
    bool IsReady,
    IReadOnlyDictionary<string, string> Upstreams);

/// <summary>
/// Asks every required cluster's first reachable destination for its liveness endpoint so the
/// gateway can report whether it can actually serve traffic, not merely that it is running.
/// </summary>
public sealed class GatewayUpstreamReadinessProbe
{
    public const string HttpClientName = "gateway-upstream-readiness";

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IProxyStateLookup _proxyState;
    private readonly GatewayReadinessOptions _options;
    private readonly ILogger<GatewayUpstreamReadinessProbe> _logger;
    private readonly SemaphoreSlim _probeGate = new(1, 1);

    private GatewayReadinessSnapshot? _cached;
    private long _cachedAtTimestamp;

    public GatewayUpstreamReadinessProbe(
        IHttpClientFactory httpClientFactory,
        IProxyStateLookup proxyState,
        GatewayReadinessOptions options,
        ILogger<GatewayUpstreamReadinessProbe> logger)
    {
        _httpClientFactory = httpClientFactory;
        _proxyState = proxyState;
        _options = options;
        _logger = logger;
    }

    public async Task<GatewayReadinessSnapshot> GetAsync(CancellationToken cancellationToken)
    {
        if (TryGetCached(out var cached))
            return cached;

        await _probeGate.WaitAsync(cancellationToken);
        try
        {
            if (TryGetCached(out cached))
                return cached;

            var snapshot = await ProbeAsync(cancellationToken);
            _cached = snapshot;
            _cachedAtTimestamp = Stopwatch.GetTimestamp();
            return snapshot;
        }
        finally
        {
            _probeGate.Release();
        }
    }

    private bool TryGetCached(out GatewayReadinessSnapshot snapshot)
    {
        var cached = _cached;
        if (cached is not null
            && _options.CacheSeconds > 0
            && Stopwatch.GetElapsedTime(_cachedAtTimestamp)
                < TimeSpan.FromSeconds(_options.CacheSeconds))
        {
            snapshot = cached;
            return true;
        }

        snapshot = default!;
        return false;
    }

    private async Task<GatewayReadinessSnapshot> ProbeAsync(CancellationToken cancellationToken)
    {
        var required = _options.RequiredClusters.Count > 0
            ? _options.RequiredClusters.ToHashSet(StringComparer.OrdinalIgnoreCase)
            : null;

        var targets = new List<(string ClusterId, string Address)>();
        var results = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        foreach (var cluster in _proxyState.GetClusters())
        {
            if (required is not null && !required.Contains(cluster.ClusterId))
                continue;

            var address = cluster.DestinationsState.AllDestinations
                .Select(destination => destination.Model.Config.Address)
                .FirstOrDefault(address => !string.IsNullOrWhiteSpace(address));

            if (string.IsNullOrWhiteSpace(address))
            {
                results[cluster.ClusterId] = "no_destination";
                continue;
            }

            targets.Add((cluster.ClusterId, address));
        }

        if (required is not null)
        {
            foreach (var clusterId in required)
            {
                if (!results.ContainsKey(clusterId)
                    && !targets.Exists(target => string.Equals(
                        target.ClusterId,
                        clusterId,
                        StringComparison.OrdinalIgnoreCase)))
                {
                    results[clusterId] = "not_configured";
                }
            }
        }

        var probes = targets
            .Select(async target =>
                (target.ClusterId, Status: await ProbeUpstreamAsync(target.Address, cancellationToken)))
            .ToArray();

        foreach (var (clusterId, status) in await Task.WhenAll(probes))
            results[clusterId] = status;

        var isReady = results.Count > 0 && results.Values.All(status => status == "ready");
        return new GatewayReadinessSnapshot(isReady, results);
    }

    private async Task<string> ProbeUpstreamAsync(string address, CancellationToken cancellationToken)
    {
        var requestUri = new Uri(
            new Uri(address.EndsWith('/') ? address : address + "/"),
            _options.UpstreamHealthPath.TrimStart('/'));

        try
        {
            var client = _httpClientFactory.CreateClient(HttpClientName);
            using var response = await client.GetAsync(
                requestUri,
                HttpCompletionOption.ResponseHeadersRead,
                cancellationToken);

            return response.IsSuccessStatusCode
                ? "ready"
                : $"unhealthy_{(int)response.StatusCode}";
        }
        catch (Exception ex) when (ex is not OperationCanceledException
                                       || !cancellationToken.IsCancellationRequested)
        {
            _logger.LogDebug(ex, "Upstream readiness probe failed for {RequestUri}", requestUri);
            return "unreachable";
        }
    }
}

public static class GatewayReadinessExtensions
{
    public static IServiceCollection AddGatewayUpstreamReadiness(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var options = GatewayReadinessOptions.FromConfiguration(configuration);
        services.AddSingleton(options);

        if (!options.Enabled)
            return services;

        services
            .AddHttpClient(
                GatewayUpstreamReadinessProbe.HttpClientName,
                client => client.Timeout = TimeSpan.FromSeconds(options.TimeoutSeconds));
        services.AddSingleton<GatewayUpstreamReadinessProbe>();

        return services;
    }

    /// <summary>
    /// Maps <c>/ready</c>. Falls back to reporting the gateway's own liveness only when the
    /// upstream probe is disabled, so the endpoint always exists for orchestrators.
    /// </summary>
    public static WebApplication MapGatewayUpstreamReady(
        this WebApplication app,
        string serviceName)
    {
        var options = app.Services.GetService<GatewayReadinessOptions>();
        if (options is null or { Enabled: false })
        {
            app.MapGet("/ready", () => Results.Ok(new { status = "ready", service = serviceName }));
            return app;
        }

        app.MapGet(
            "/ready",
            async (GatewayUpstreamReadinessProbe probe, CancellationToken cancellationToken) =>
            {
                var snapshot = await probe.GetAsync(cancellationToken);
                var payload = new
                {
                    status = snapshot.IsReady ? "ready" : "not_ready",
                    service = serviceName,
                    upstreams = snapshot.Upstreams,
                };

                return snapshot.IsReady
                    ? Results.Ok(payload)
                    : Results.Json(payload, statusCode: StatusCodes.Status503ServiceUnavailable);
            });

        return app;
    }
}
