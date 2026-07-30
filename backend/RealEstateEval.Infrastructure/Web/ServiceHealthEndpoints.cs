using System.Diagnostics;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using RealEstateEval.Infrastructure.Data;

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

public sealed record DatabaseReadinessSnapshot(bool IsReady, string Database, int PendingMigrations);

public static class ServiceHealthEndpoints
{
    private const string LogCategory = "RealEstateEval.Readiness";

    /// <summary>
    /// Maps <c>/ready</c> for a service whose hard dependency is its database: reachable and
    /// migrated. Failures are logged with the exception instead of being reduced to a 503.
    /// </summary>
    public static WebApplication MapDatabaseReady(this WebApplication app, string serviceName)
    {
        var options = DatabaseReadinessOptions.FromConfiguration(
            app.Configuration,
            app.Environment);
        var cache = new ReadinessCache(TimeSpan.FromSeconds(options.CacheSeconds));

        app.MapGet("/ready", async (
            ApplicationDbContext db,
            ILoggerFactory loggerFactory,
            CancellationToken cancellationToken) =>
        {
            var logger = loggerFactory.CreateLogger(LogCategory);
            var snapshot = await cache.GetAsync(
                () => ProbeAsync(db, options, serviceName, logger, cancellationToken),
                cancellationToken);

            var payload = new
            {
                status = snapshot.IsReady ? "ready" : "not_ready",
                service = serviceName,
                database = snapshot.Database,
                pendingMigrations = snapshot.PendingMigrations,
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
        ApplicationDbContext db,
        DatabaseReadinessOptions options,
        string serviceName,
        ILogger logger,
        CancellationToken cancellationToken)
    {
        try
        {
            if (!await db.Database.CanConnectAsync(cancellationToken))
            {
                logger.LogWarning(
                    "Readiness for {Service}: database is unreachable.",
                    serviceName);
                return new DatabaseReadinessSnapshot(false, "unreachable", 0);
            }

            if (!options.CheckMigrations)
                return new DatabaseReadinessSnapshot(true, "ready", 0);

            var pending = await db.Database.GetPendingMigrationsAsync(cancellationToken);
            var pendingCount = pending.Count();
            if (pendingCount > 0)
            {
                logger.LogError(
                    "Readiness for {Service}: {PendingCount} migration(s) not applied ({Migrations}). Run the migrate job before serving traffic.",
                    serviceName,
                    pendingCount,
                    string.Join(", ", pending));
                return new DatabaseReadinessSnapshot(false, "migrations_pending", pendingCount);
            }

            return new DatabaseReadinessSnapshot(true, "ready", 0);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Readiness probe for {Service} failed.", serviceName);
            return new DatabaseReadinessSnapshot(false, "unreachable", 0);
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
