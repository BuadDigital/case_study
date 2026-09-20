using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Integration;

namespace RealEstateEval.Application.Tests;

public class OutboxMetricsTests
{
    [Fact]
    public void SetBacklog_exposes_pending_dead_letter_and_age()
    {
        var metrics = new OutboxMetrics();
        metrics.SetBacklog(pending: 4, deadLettered: 2, oldestPendingAgeSeconds: 12.5);

        Assert.Equal(4, metrics.Pending);
        Assert.Equal(2, metrics.DeadLetteredBacklog);
        Assert.Equal(12.5, metrics.OldestPendingAgeSeconds);
    }

    [Fact]
    public void SetBacklog_clamps_negative_age()
    {
        var metrics = new OutboxMetrics();
        metrics.SetBacklog(0, 0, -3);
        Assert.Equal(0, metrics.OldestPendingAgeSeconds);
    }

    [Fact]
    public async Task Collector_samples_pending_and_dead_lettered_rows()
    {
        var options = new DbContextOptionsBuilder<MessagingDbContext>()
            .UseInMemoryDatabase($"outbox-metrics-{Guid.NewGuid():N}")
            .Options;
        await using var db = new MessagingDbContext(options);
        var now = new DateTime(2026, 9, 20, 12, 0, 0, DateTimeKind.Utc);
        db.OutboxMessages.AddRange(
            new OutboxMessage
            {
                Id = Guid.NewGuid(),
                EventType = "pending.old",
                CreatedAtUtc = now.AddMinutes(-2),
            },
            new OutboxMessage
            {
                Id = Guid.NewGuid(),
                EventType = "pending.new",
                CreatedAtUtc = now.AddSeconds(-10),
            },
            new OutboxMessage
            {
                Id = Guid.NewGuid(),
                EventType = "done",
                CreatedAtUtc = now.AddMinutes(-5),
                ProcessedAtUtc = now.AddMinutes(-4),
            },
            new OutboxMessage
            {
                Id = Guid.NewGuid(),
                EventType = "poison",
                CreatedAtUtc = now.AddMinutes(-9),
                DeadLetteredAtUtc = now.AddMinutes(-1),
            });
        await db.SaveChangesAsync();

        var services = new ServiceCollection();
        services.AddSingleton(db);
        await using var provider = services.BuildServiceProvider();
        var metrics = new OutboxMetrics();
        var collector = new OutboxMetricsCollectorHostedService(
            provider.GetRequiredService<IServiceScopeFactory>(),
            Options.Create(new OutboxDispatcherOptions { ContextType = typeof(MessagingDbContext) }),
            metrics,
            NullLogger<OutboxMetricsCollectorHostedService>.Instance,
            new FrozenTimeProvider(now));

        await collector.SampleAsync(CancellationToken.None);

        Assert.Equal(2, metrics.Pending);
        Assert.Equal(1, metrics.DeadLetteredBacklog);
        Assert.Equal(120, metrics.OldestPendingAgeSeconds);
    }

    private sealed class FrozenTimeProvider : TimeProvider
    {
        private readonly DateTimeOffset _utc;

        public FrozenTimeProvider(DateTime utcNow) =>
            _utc = new DateTimeOffset(DateTime.SpecifyKind(utcNow, DateTimeKind.Utc));

        public override DateTimeOffset GetUtcNow() => _utc;
    }
}
