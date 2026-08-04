using RealEstateEval.Architecture.Tests.Support;

namespace RealEstateEval.Architecture.Tests;

/// <summary>
/// E7 residual: while messaging shares one DB, only Case Study may host the outbox
/// publisher. Competing hosts would double-publish under SKIP LOCKED races or leave
/// stranded rows when a second database cuts over without its own dispatcher.
/// </summary>
public class OutboxDispatcherHostTests
{
    [Fact]
    public void Only_case_study_registers_AddOutboxDispatcher()
    {
        var servicesRoot = RepoPaths.Combine("backend", "services");
        var hosts = new List<string>();

        foreach (var program in Directory.EnumerateFiles(
                     servicesRoot,
                     "Program.cs",
                     SearchOption.AllDirectories))
        {
            var text = File.ReadAllText(program);
            if (!text.Contains("AddOutboxDispatcher", StringComparison.Ordinal))
                continue;

            var relative = program.Replace('\\', '/');
            var marker = "/services/";
            var idx = relative.IndexOf(marker, StringComparison.OrdinalIgnoreCase);
            var service = idx < 0
                ? relative
                : relative[(idx + marker.Length)..].Split('/')[0];
            hosts.Add(service);
        }

        Assert.Equal(["case-study"], hosts.OrderBy(x => x, StringComparer.Ordinal).ToArray());
    }
}
