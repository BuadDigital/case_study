using System.Diagnostics;
using System.Net.Sockets;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Integration;

namespace RealEstateEval.Infrastructure.Web;

/// <summary>
/// Readiness probe settings, bound from the <c>Readiness</c> section.
/// </summary>
public sealed class DatabaseReadinessOptions
{
    public const string SectionName = "Readiness";

    /// <summary>
    /// Connectivity alone cannot tell a migrated schema from an empty one, so a service with
    /// pending migrations reports not-ready. Off in Development, where the shared dev database
    /// is migrated by whichever service starts first.
    /// </summary>
    public bool CheckMigrations { get; init; }

    /// <summary>
    /// Soft RabbitMQ TCP reachability for hosts that own outbox / consumers. When true and
    /// <c>RabbitMQ:Enabled</c>, the probe reports <c>rabbit</c> status in the body but does
    /// <b>not</b> flip the HTTP 503 (broker flap must not take traffic offline).
    /// </summary>
    public bool CheckRabbit { get; init; }

    /// <summary>Container healthchecks poll frequently; results are reused for this long.</summary>
    public int CacheSeconds { get; init; } = 5;

    public static DatabaseReadinessOptions FromConfiguration(
        IConfiguration configuration,
        IHostEnvironment environment)
    {
        var section = configuration.GetSection(SectionName);

        var options = new DatabaseReadinessOptions
        {
            CheckMigrations = section.GetValue("CheckMigrations", !environment.IsDevelopment()),
            CheckRabbit = section.GetValue("CheckRabbit", false),
            CacheSeconds = section.GetValue("CacheSeconds", 5),
        };

        options.Validate();
        return options;
    }

    public void Validate()
    {
        if (CacheSeconds is < 0 or > 300)
        {
            throw new InvalidOperationException(
                $"{SectionName}:CacheSeconds must be between 0 and 300.");
        }
    }
}

public sealed record DatabaseReadinessSnapshot(
    bool IsReady,
    string Database,
    int PendingMigrations,
    string? Rabbit);

public static class ServiceHealthEndpoints
{
    private const string LogCategory = "RealEstateEval.Readiness";

    /// <summary>
    /// Residual readiness for hosts that still register the legacy
    /// <see cref="ApplicationDbContext"/> pool.
    /// </summary>
    public static WebApplication MapDatabaseReady(this WebApplication app, string serviceName) =>
        MapDatabaseReady<ApplicationDbContext>(app, serviceName);

    /// <summary>
    /// Maps <c>/ready</c> against one owned write context (A6 pure hosts). Connectivity and
    /// that stream's pending migrations are checked — not the frozen legacy full model.
    /// </summary>
    public static WebApplication MapDatabaseReady<TContext>(this WebApplication app, string serviceName)
        where TContext : DbContext =>
        MapDatabaseReady(app, serviceName, typeof(TContext));

    /// <summary>
    /// Maps <c>/ready</c> for a host with multiple owned write contexts (e.g. Platform catalogs +
    /// messaging). Any stream with pending migrations fails readiness.
    /// </summary>
    public static WebApplication MapDatabaseReady(
        this WebApplication app,
        string serviceName,
        params Type[] contextTypes)
    {
        if (contextTypes is null || contextTypes.Length == 0)
            throw new ArgumentException("At least one DbContext type is required.", nameof(contextTypes));

        foreach (var type in contextTypes)
        {
            if (!typeof(DbContext).IsAssignableFrom(type))
            {
                throw new ArgumentException(
                    $"{type.Name} is not a DbContext.",
                    nameof(contextTypes));
            }
        }

        var options = DatabaseReadinessOptions.FromConfiguration(
            app.Configuration,
            app.Environment);
        var cache = new ReadinessCache(TimeSpan.FromSeconds(options.CacheSeconds));

        app.MapGet("/ready", async (
            HttpContext http,
            ILoggerFactory loggerFactory,
            CancellationToken cancellationToken) =>
        {
            var logger = loggerFactory.CreateLogger(LogCategory);
            var snapshot = await cache.GetAsync(
                () => ProbeAsync(
                    http.RequestServices,
                    contextTypes,
                    options,
                    serviceName,
                    logger,
                    cancellationToken),
                cancellationToken);

            var payload = new
            {
                status = snapshot.IsReady ? "ready" : "not_ready",
                service = serviceName,
                database = snapshot.Database,
                pendingMigrations = snapshot.PendingMigrations,
                rabbit = snapshot.Rabbit,
            };

            return snapshot.IsReady
                ? Results.Ok(payload)
                : Results.Json(payload, statusCode: StatusCodes.Status503ServiceUnavailable);
        });

        return app;
    }

    /// <summary>
    /// Maps <c>/ready</c> for a service with no hard dependency of its own — it holds no schema,
    /// and its upstreams are probed by the gateway's own readiness endpoint. Kept as a named
    /// helper so "ready as soon as it is listening" is a deliberate choice, not an oversight.
    /// </summary>
    public static WebApplication MapStatelessReady(this WebApplication app, string serviceName)
    {
        app.MapGet(
            "/ready",
            () => Results.Ok(new { status = "ready", service = serviceName }));

        return app;
    }

    private static async Task<DatabaseReadinessSnapshot> ProbeAsync(
        IServiceProvider services,
        Type[] contextTypes,
        DatabaseReadinessOptions options,
        string serviceName,
        ILogger logger,
        CancellationToken cancellationToken)
    {
        try
        {
            var pendingTotal = 0;
            var sawConnect = false;

            foreach (var type in contextTypes)
            {
                if (services.GetService(type) is not DbContext db)
                {
                    logger.LogError(
                        "Readiness for {Service}: {Context} is not registered.",
                        serviceName,
                        type.Name);
                    return new DatabaseReadinessSnapshot(false, "context_missing", 0, null);
                }

                if (!await db.Database.CanConnectAsync(cancellationToken))
                {
                    logger.LogWarning(
                        "Readiness for {Service}: database is unreachable ({Context}).",
                        serviceName,
                        type.Name);
                    return new DatabaseReadinessSnapshot(false, "unreachable", 0, null);
                }

                sawConnect = true;

                if (options.CheckMigrations)
                {
                    var pending = (await db.Database.GetPendingMigrationsAsync(cancellationToken)).Count();
                    pendingTotal += pending;
                    if (pending > 0)
                    {
                        logger.LogError(
                            "Readiness for {Service}: {PendingCount} migration(s) not applied on {Context}. Run the migrate job before serving traffic.",
                            serviceName,
                            pending,
                            type.Name);
                    }
                }
            }

            if (!sawConnect)
                return new DatabaseReadinessSnapshot(false, "unreachable", 0, null);

            if (pendingTotal > 0)
            {
                return new DatabaseReadinessSnapshot(
                    false,
                    "migrations_pending",
                    pendingTotal,
                    null);
            }

            var rabbit = await ProbeRabbitSoftAsync(
                services,
                options,
                serviceName,
                logger,
                cancellationToken);

            return new DatabaseReadinessSnapshot(true, "ready", 0, rabbit);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Readiness probe for {Service} failed.", serviceName);
            return new DatabaseReadinessSnapshot(false, "unreachable", 0, null);
        }
    }

    private static async Task<string?> ProbeRabbitSoftAsync(
        IServiceProvider services,
        DatabaseReadinessOptions options,
        string serviceName,
        ILogger logger,
        CancellationToken cancellationToken)
    {
        if (!options.CheckRabbit)
            return null;

        var monitor = services.GetService<IOptionsMonitor<RabbitMqOptions>>();
        if (monitor is null)
            return "not_configured";

        var rabbit = monitor.CurrentValue;
        if (!rabbit.Enabled)
            return "disabled";

        try
        {
            using var client = new TcpClient();
            using var reg = cancellationToken.Register(() => client.Dispose());
            await client.ConnectAsync(rabbit.Host, rabbit.Port, cancellationToken);
            return "reachable";
        }
        catch (Exception ex)
        {
            logger.LogWarning(
                ex,
                "Readiness for {Service}: RabbitMQ soft-check failed ({Host}:{Port}).",
                serviceName,
                rabbit.Host,
                rabbit.Port);
            return "unreachable";
        }
    }

    /// <summary>Single-flight cache so frequent probes do not fan out into the database.</summary>
    private sealed class ReadinessCache(TimeSpan timeToLive)
    {
        private readonly SemaphoreSlim _gate = new(1, 1);
        private DatabaseReadinessSnapshot? _cached;
        private long _cachedAtTimestamp;

        public async Task<DatabaseReadinessSnapshot> GetAsync(
            Func<Task<DatabaseReadinessSnapshot>> probe,
            CancellationToken cancellationToken)
        {
            if (TryGetCached(out var cached))
                return cached;

            await _gate.WaitAsync(cancellationToken);
            try
            {
                if (TryGetCached(out cached))
                    return cached;

                var snapshot = await probe();
                _cached = snapshot;
                _cachedAtTimestamp = Stopwatch.GetTimestamp();
                return snapshot;
            }
            finally
            {
                _gate.Release();
            }
        }

        private bool TryGetCached(out DatabaseReadinessSnapshot snapshot)
        {
            var cached = _cached;
            if (cached is not null
                && timeToLive > TimeSpan.Zero
                && Stopwatch.GetElapsedTime(_cachedAtTimestamp) < timeToLive)
            {
                snapshot = cached;
                return true;
            }

            snapshot = default!;
            return false;
        }
    }
}
