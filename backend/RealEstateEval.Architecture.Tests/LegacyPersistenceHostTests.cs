using RealEstateEval.Architecture.Tests.Support;

namespace RealEstateEval.Architecture.Tests;

/// <summary>
/// exit criterion.
/// Residual dual-write host is case-study only (outbox drain + multi-boundary writers).
/// </summary>
public class LegacyPersistenceHostTests
{
    private static readonly HashSet<string> ResidualLegacyHosts = new(StringComparer.Ordinal)
    {
        "case-study",
    };

    private static readonly HashSet<string> PureExtractedHosts = new(StringComparer.Ordinal)
    {
        "attachments",
        "failures",
        "financial",
        "identity",
        "operations",
        "platform",
        "valuation",
        "reporting",
    };

    [Fact]
    public void Pure_extracted_hosts_do_not_call_AddPersistence()
    {
        var servicesRoot = RepoPaths.Combine("backend", "services");
        var violations = new List<string>();

        foreach (var program in Directory.EnumerateFiles(
                     servicesRoot,
                     "Program.cs",
                     SearchOption.AllDirectories))
        {
            var relative = program.Replace('\\', '/');
            var marker = "/services/";
            var idx = relative.IndexOf(marker, StringComparison.OrdinalIgnoreCase);
            if (idx < 0) continue;
            var service = relative[(idx + marker.Length)..].Split('/')[0];

            if (!PureExtractedHosts.Contains(service))
                continue;

            var text = File.ReadAllText(program);
            if (text.Contains("AddPersistence(", StringComparison.Ordinal)
                || text.Contains("AddLegacyApplicationPersistence(", StringComparison.Ordinal))
            {
                violations.Add(service);
            }
        }

        Assert.True(
            violations.Count == 0,
            "Pure extracted hosts must not register the residual ApplicationDbContext pool:\n  "
            + string.Join("\n  ", violations)
            + "\nUse AddHostSharedInfrastructure + owned Add*Persistence instead (A6).");
    }

    [Fact]
    public void Residual_hosts_still_register_AddPersistence()
    {
        var missing = new List<string>();
        var servicesRoot = RepoPaths.Combine("backend", "services");

        foreach (var expected in ResidualLegacyHosts.OrderBy(x => x, StringComparer.Ordinal))
        {
            var found = Directory.EnumerateFiles(
                    Path.Combine(servicesRoot, expected),
                    "Program.cs",
                    SearchOption.AllDirectories)
                .FirstOrDefault();
            if (found is null)
            {
                missing.Add($"{expected} (Program.cs missing)");
                continue;
            }

            var text = File.ReadAllText(found);
            if (!text.Contains("AddPersistence(", StringComparison.Ordinal))
                missing.Add(expected);
        }

        Assert.True(
            missing.Count == 0,
            "Residual dual-write hosts should keep AddPersistence until pure cutover:\n  "
            + string.Join("\n  ", missing));
    }
}
