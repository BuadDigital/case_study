using RealEstateEval.Architecture.Tests.Support;

namespace RealEstateEval.Architecture.Tests;

/// <summary>
/// Ratchet on use-case growth in <c>contexts/*/Application/Services</c>. A use case that
/// outgrows the cap is split by concern (<c>partial class</c> files) and its decision logic
/// moved to <c>Application/Rules</c> where it is unit-tested without ports. Files already over
/// the cap are frozen here; nothing new may join them, and a file that shrinks below the cap
/// must leave the list so it cannot regrow unnoticed.
/// </summary>
public class ApplicationServiceSizeTests
{
    private const int MaxLines = 500;

    /// <summary>
    /// Empty since 2026-09-06: the thirteen services over the cap were split into partial
    /// files and their rules extracted (docs/architecture/solid-scorecard.md, "Application
    /// service size cap"). The list stays so a service that grows past the cap has somewhere
    /// it must be recorded — and the ratchet below keeps that record from going stale.
    /// </summary>
    private static readonly string[] FrozenOverCap = [];

    [Fact]
    public void No_new_application_service_exceeds_the_cap()
    {
        var offenders = ApplicationServiceFiles()
            .Select(file => (Relative: RepoPaths.Relative(file), Lines: LineCount(file)))
            .Where(entry => entry.Lines > MaxLines)
            .Where(entry => !FrozenOverCap.Contains(entry.Relative, StringComparer.Ordinal))
            .Select(entry => $"{entry.Relative} ({entry.Lines} lines)")
            .ToList();

        Assert.True(
            offenders.Count == 0,
            $"Application services over {MaxLines} lines that are not in the frozen list. Split the "
            + "service into partial files by concern and move decisions to Application/Rules:\n  "
            + string.Join("\n  ", offenders));
    }

    [Fact]
    public void Frozen_list_only_names_files_still_over_the_cap()
    {
        var stale = FrozenOverCap
            .Where(relative =>
            {
                var file = RepoPaths.Combine(relative.Split('/'));
                return !File.Exists(file) || LineCount(file) <= MaxLines;
            })
            .ToList();

        Assert.True(
            stale.Count == 0,
            "Frozen entries that shrank below the cap or moved. Remove them so the ratchet only turns one way:\n  "
            + string.Join("\n  ", stale));
    }

    private static IEnumerable<string> ApplicationServiceFiles() =>
        Directory
            .EnumerateDirectories(RepoPaths.Combine("backend", "contexts"))
            .SelectMany(context => Directory.EnumerateDirectories(context, "*.Application"))
            .Select(application => Path.Combine(application, "Services"))
            .SelectMany(RepoPaths.CSharpFiles);

    private static int LineCount(string file) => File.ReadAllLines(file).Length;
}
