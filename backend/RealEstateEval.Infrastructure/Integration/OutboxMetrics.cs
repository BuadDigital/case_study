using System.Diagnostics.Metrics;

namespace RealEstateEval.Infrastructure.Integration;

/// <summary>
/// Outbox instruments for the production metrics window: dispatch counters plus a polled
/// backlog (pending rows, parked poison rows, age of the oldest pending row).
/// Meter name must stay in sync with <c>ObservabilityExtensions</c> (<c>AddMeter</c>).
/// </summary>
public sealed class OutboxMetrics
{
    public const string MeterName = "RealEstateEval.Outbox";

    private readonly Counter<long> _dispatched;
    private readonly Counter<long> _deadLettered;
    private readonly Counter<long> _publishFailed;
    private long _pending;
    private long _deadLetteredBacklog;
    private double _oldestPendingAgeSeconds;

    public OutboxMetrics()
    {
        var meter = new Meter(MeterName);
        _dispatched = meter.CreateCounter<long>("outbox.messages.dispatched", unit: "{message}");
        _deadLettered = meter.CreateCounter<long>("outbox.messages.dead_lettered", unit: "{message}");
        _publishFailed = meter.CreateCounter<long>("outbox.messages.publish_failed", unit: "{message}");
        meter.CreateObservableGauge(
            "outbox.backlog.pending",
            () => Volatile.Read(ref _pending),
            unit: "{message}");
        meter.CreateObservableGauge(
            "outbox.backlog.dead_lettered",
            () => Volatile.Read(ref _deadLetteredBacklog),
            unit: "{message}");
        meter.CreateObservableGauge(
            "outbox.oldest_pending_age",
            () => Volatile.Read(ref _oldestPendingAgeSeconds),
            unit: "s");
    }

    public long Pending => Volatile.Read(ref _pending);

    public long DeadLetteredBacklog => Volatile.Read(ref _deadLetteredBacklog);

    public double OldestPendingAgeSeconds => Volatile.Read(ref _oldestPendingAgeSeconds);

    public void RecordDispatched(int count)
    {
        if (count > 0)
            _dispatched.Add(count);
    }

    public void RecordDeadLettered(int count = 1)
    {
        if (count > 0)
            _deadLettered.Add(count);
    }

    public void RecordPublishFailed(int count)
    {
        if (count > 0)
            _publishFailed.Add(count);
    }

    public void SetBacklog(int pending, int deadLettered, double oldestPendingAgeSeconds)
    {
        Volatile.Write(ref _pending, pending);
        Volatile.Write(ref _deadLetteredBacklog, deadLettered);
        Volatile.Write(ref _oldestPendingAgeSeconds, Math.Max(0, oldestPendingAgeSeconds));
    }
}
