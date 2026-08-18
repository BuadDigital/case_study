using System.Text.RegularExpressions;
using RealEstateEval.Architecture.Tests.Support;

namespace RealEstateEval.Architecture.Tests;

/// <summary>
/// B8: production clocks go through <see cref="TimeProvider"/> so tests can freeze time.
/// </summary>
public class TimeProviderUsageTests
{
    private static readonly Regex DirectUtcNow = new(
        @"\bDateTime(?:Offset)?\.UtcNow\b",
        RegexOptions.Compiled);

    [Fact]
    public void Production_code_does_not_call_DateTime_UtcNow()
    {
        var roots = new[]
        {
            RepoPaths.Combine("backend", "RealEstateEval.Application"),
            RepoPaths.Combine("backend", "RealEstateEval.Infrastructure", "Services"),
            RepoPaths.Combine("backend", "RealEstateEval.Infrastructure", "Integration"),
            RepoPaths.Combine("backend", "services"),
        };

        var violations = new List<string>();
        foreach (var root in roots)
        {
            foreach (var file in RepoPaths.CSharpFiles(root))
            {
                var relative = RepoPaths.Relative(file);
                if (relative.Contains("/Migrations/", StringComparison.Ordinal))
                    continue;

                var text = File.ReadAllText(file);
                foreach (Match match in DirectUtcNow.Matches(text))
                    violations.Add($"{relative}: {match.Value}");
            }
        }

        Assert.True(
            violations.Count == 0,
            "Inject TimeProvider and use time.UtcNow() / time.GetUtcNow() instead of DateTime.UtcNow:\n  "
            + string.Join("\n  ", violations));
    }
}
