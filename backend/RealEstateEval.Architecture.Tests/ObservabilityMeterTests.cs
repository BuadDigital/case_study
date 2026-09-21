using RealEstateEval.Architecture.Tests.Support;

namespace RealEstateEval.Architecture.Tests;

/// <summary>
/// Production metrics window: HTTP duration already comes from ASP.NET instrumentation.
/// Pool and outbox series only appear in Grafana when these meters are registered.
/// </summary>
public class ObservabilityMeterTests
{
    [Fact]
    public void Observability_exports_runtime_npgsql_and_outbox_meters()
    {
        var source = File.ReadAllText(
            RepoPaths.Combine(
                "backend",
                "shared",
                "RealEstateEval.Shared.Web",
                "ObservabilityExtensions.cs"));

        Assert.Contains("AddRuntimeInstrumentation()", source, StringComparison.Ordinal);
        Assert.Contains("AddMeter(\"Npgsql\")", source, StringComparison.Ordinal);
        Assert.Contains("AddMeter(\"RealEstateEval.Outbox\")", source, StringComparison.Ordinal);
        Assert.DoesNotContain("MapPrometheusScrapingEndpoint", source, StringComparison.Ordinal);
    }
}
