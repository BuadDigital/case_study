using RealEstateEval.Architecture.Tests.Support;

namespace RealEstateEval.Architecture.Tests;

/// <summary>
/// A6 exit criterion: no service host registers the legacy ApplicationDbContext pool.
/// </summary>
public class LegacyPersistenceHostTests
{
    private static readonly HashSet<string> PureExtractedHosts = new(StringComparer.Ordinal)
    {
        "attachments",
        "case-study",
        "failures",
        "financial",
        "identity",
        "operations",
        "platform",
        "valuation",
        "reporting",
    };

    [Fact]
    public void All_service_hosts_do_not_call_AddPersistence()
    {
        var servicesRoot = RepoPaths.Combine("backend", "services");
        var violations = new List<string>();

        foreach (var file in RepoPaths.CSharpFiles(servicesRoot))
        {
            var relative = RepoPaths.Relative(file);
            var marker = "backend/services/";
            var idx = relative.IndexOf(marker, StringComparison.OrdinalIgnoreCase);
            if (idx < 0) continue;
            var service = relative[(idx + marker.Length)..].Split('/')[0];

            if (!PureExtractedHosts.Contains(service))
                continue;

            var text = File.ReadAllText(file);
            if (text.Contains("AddPersistence(", StringComparison.Ordinal)
                || text.Contains("AddLegacyApplicationPersistence(", StringComparison.Ordinal))
            {
                violations.Add($"{service} ({relative})");
            }
        }

        Assert.True(
            violations.Count == 0,
            "Service hosts must not register the residual ApplicationDbContext pool:\n  "
            + string.Join("\n  ", violations)
            + "\nUse AddHostSharedInfrastructure + owned Add*Persistence instead (A6).");
    }
}
