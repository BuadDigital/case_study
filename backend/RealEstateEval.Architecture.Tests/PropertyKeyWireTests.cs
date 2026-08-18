using System.Text.RegularExpressions;
using RealEstateEval.Architecture.Tests.Support;

namespace RealEstateEval.Architecture.Tests;

/// <summary>
/// B1: property-key workflow/gate wire values live on named Domain constants.
/// </summary>
public class PropertyKeyWireTests
{
    private static readonly Regex QuotedWire = new(
        @"""(done|progress|pending|received|not_required|yes|no|court_access|envelope|none|legacy|government-review)""",
        RegexOptions.Compiled);

    [Fact]
    public void Property_key_services_do_not_embed_wire_literals()
    {
        var files = new[]
        {
            // A8: property-key services live in the Operations context.
            RepoPaths.Combine(
                "backend", "contexts", "operations", "RealEstateEval.Operations.Infrastructure",
                "Services", "PropertyKeysService.cs"),
            RepoPaths.Combine(
                "backend", "contexts", "operations", "RealEstateEval.Operations.Infrastructure",
                "Services", "PropertyKeyGateResolver.cs"),
        };

        var violations = new List<string>();
        foreach (var file in files)
        {
            var text = File.ReadAllText(file);
            foreach (Match match in QuotedWire.Matches(text))
                violations.Add($"{RepoPaths.Relative(file)}: {match.Value}");
        }

        Assert.True(
            violations.Count == 0,
            "Use PropertyKey* / PropertyKeysStatuses / WorkflowTaskKindValues instead of quoted wire strings:\n  "
            + string.Join("\n  ", violations));
    }

    [Fact]
    public void Property_list_timeline_and_financial_hot_paths_do_not_embed_wire_literals()
    {
        var checks = new (string File, Regex Pattern)[]
        {
            (
                // A8: property list/timeline services live in the Case Study context.
                RepoPaths.Combine(
                    "backend", "contexts", "case-study", "RealEstateEval.CaseStudy.Infrastructure",
                    "Services", "PropertyListRowBuilder.cs"),
                new Regex(@"""(new|progress|done|fail|incomplete)""", RegexOptions.Compiled)
            ),
            (
                RepoPaths.Combine(
                    "backend", "contexts", "case-study", "RealEstateEval.CaseStudy.Infrastructure",
                    "Services", "PropertyTimelineService.cs"),
                new Regex(@"""(done|active|warn|muted)""", RegexOptions.Compiled)
            ),
            (
                // A8: the financial report service lives in the Financial context.
                RepoPaths.Combine(
                    "backend", "contexts", "financial", "RealEstateEval.Financial.Infrastructure",
                    "Services", "FinancialReportService.cs"),
                new Regex(@"""(done|progress)""", RegexOptions.Compiled)
            ),
        };

        var violations = new List<string>();
        foreach (var (file, pattern) in checks)
        {
            var text = File.ReadAllText(file);
            foreach (Match match in pattern.Matches(text))
                violations.Add($"{RepoPaths.Relative(file)}: {match.Value}");
        }

        Assert.True(
            violations.Count == 0,
            "Use PropertyListRowStatuses / PropertyTimelineTones / FinancialRevenueRowStatuses:\n  "
            + string.Join("\n  ", violations));
    }
}
