using System.Text.RegularExpressions;
using RealEstateEval.Architecture.Tests.Support;

namespace RealEstateEval.Architecture.Tests;

/// <summary>
/// The business calendar is Riyadh's: "today" and "this year" from a UTC clock are the UTC day/year,
/// which is wrong from 21:00 UTC on. Turning the clock into a calendar day goes through RiyadhClock
/// (Shared.Contracts/Domain/RiyadhClock.cs) — timestamps stay UTC.
/// </summary>
public class RiyadhCalendarUsageTests
{
    private static readonly Regex UtcDay = new(
        @"DateOnly\.FromDateTime\([^;]*UtcNow"
        + @"|\bUtcNow\(\)\.(?:Year|Date)\b"
        + @"|\bGetUtcNow\(\)\.(?:UtcDateTime\.)?(?:Year|Date)\b",
        RegexOptions.Compiled);

    [Fact]
    public void Calendar_days_from_the_utc_clock_go_through_RiyadhClock()
    {
        var roots = new[]
        {
            RepoPaths.Combine("backend", "RealEstateEval.Application"),
            RepoPaths.Combine("backend", "RealEstateEval.Infrastructure"),
            RepoPaths.Combine("backend", "contexts"),
            RepoPaths.Combine("backend", "services"),
            RepoPaths.Combine("backend", "shared"),
        };

        var violations = new List<string>();
        foreach (var root in roots)
        {
            foreach (var file in RepoPaths.CSharpFiles(root))
            {
                var relative = RepoPaths.Relative(file);
                if (relative.Contains("/Migrations/", StringComparison.Ordinal)
                    || relative.EndsWith("/RiyadhClock.cs", StringComparison.Ordinal))
                    continue;

                var lines = File.ReadAllLines(file);
                for (var i = 0; i < lines.Length; i++)
                {
                    foreach (Match match in UtcDay.Matches(lines[i]))
                        violations.Add($"{relative}:{i + 1}: {match.Value}");
                }
            }
        }

        Assert.True(
            violations.Count == 0,
            "Use RiyadhClock.Today(time) / RiyadhClock.Year(time) for a calendar day or year — "
            + "the UTC day is yesterday in Riyadh after 21:00 UTC:\n  "
            + string.Join("\n  ", violations));
    }
}
