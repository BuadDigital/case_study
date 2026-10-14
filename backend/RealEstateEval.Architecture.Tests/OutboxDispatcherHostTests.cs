using RealEstateEval.Architecture.Tests.Support;

namespace RealEstateEval.Architecture.Tests;

/// <summary>
/// Each physical outbox database needs exactly one dispatcher. Platform drains the
/// dedicated messaging database; Valuation drains its dedicated database after the Phase 4
/// cutover. A third host would double-publish or leave stranded rows.
/// </summary>
public class OutboxDispatcherHostTests
{
    [Fact]
    public void Platform_and_valuation_register_AddOutboxDispatcher()
    {
        var servicesRoot = RepoPaths.Combine("backend", "services");
        var hosts = new List<string>();

        foreach (var file in RepoPaths.CSharpFiles(servicesRoot))
        {
            var text = File.ReadAllText(file);
            if (!text.Contains("AddOutboxDispatcher", StringComparison.Ordinal))
                continue;

            var relative = RepoPaths.Relative(file);
            var marker = "backend/services/";
            var idx = relative.IndexOf(marker, StringComparison.OrdinalIgnoreCase);
            var service = idx < 0
                ? relative
                : relative[(idx + marker.Length)..].Split('/')[0];
            hosts.Add(service);
        }

        Assert.Equal(["platform", "valuation"], hosts.OrderBy(x => x, StringComparer.Ordinal).ToArray());
    }

    [Fact]
    public void Each_dispatcher_binds_its_own_outbox_context()
    {
        var platform = File.ReadAllText(
            RepoPaths.Combine("backend", "services", "platform", "RealEstateEval.Platform.Api", "ServiceModule.cs"));
        var valuation = File.ReadAllText(
            RepoPaths.Combine("backend", "services", "valuation", "RealEstateEval.Valuation.Api", "ServiceModule.cs"));

        Assert.Contains("typeof(MessagingDbContext)", platform, StringComparison.Ordinal);
        Assert.Contains("typeof(ValuationDbContext)", valuation, StringComparison.Ordinal);
        Assert.DoesNotContain("typeof(ValuationDbContext)", platform, StringComparison.Ordinal);
        Assert.DoesNotContain("typeof(MessagingDbContext)", valuation, StringComparison.Ordinal);
    }

    [Fact]
    public void Dispatcher_hosts_register_outbox_metrics_collector()
    {
        var di = File.ReadAllText(
            RepoPaths.Combine("backend", "RealEstateEval.Infrastructure", "DependencyInjection.cs"));

        Assert.Contains("AddSingleton<OutboxMetrics>()", di, StringComparison.Ordinal);
        Assert.Contains("AddHostedService<OutboxMetricsCollectorHostedService>()", di, StringComparison.Ordinal);
    }
}
