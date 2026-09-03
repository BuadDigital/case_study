using System.Text.RegularExpressions;
using RealEstateEval.Architecture.Tests.Support;

namespace RealEstateEval.Architecture.Tests;

/// <summary>
/// docs/architecture/solid-scorecard.md finding 2: <c>ICaseStudyRepository</c> was a DbSet facade
/// with a repository name. Every consumer now depends on a per-aggregate port in
/// <c>CaseStudy.Application/Abstractions</c> and the facade itself is deleted; these tests keep it
/// deleted and forbid EF query types on any Application abstraction.
/// </summary>
public class CaseStudySessionFacadeTests
{
    [Fact]
    public void The_session_facade_stays_deleted()
    {
        var facade = RepoPaths.Combine(
            "backend",
            "RealEstateEval.Infrastructure",
            "Data",
            "Contexts",
            "CaseStudy",
            "ICaseStudyRepository.cs");

        Assert.False(
            File.Exists(facade),
            "ICaseStudyRepository was retired in favour of per-aggregate ports "
            + "(see IPartyTaskSubmissionRepository). Do not reintroduce the DbSet facade.");

        var mentions = ProductionSourceFiles()
            .Where(file => File.ReadAllText(file).Contains("ICaseStudyRepository", StringComparison.Ordinal))
            .Select(RepoPaths.Relative)
            .ToList();

        Assert.True(
            mentions.Count == 0,
            "The retired session facade is named again. Depend on a per-aggregate port in "
            + "CaseStudy.Application/Abstractions instead:\n  "
            + string.Join("\n  ", mentions));
    }

    /// <summary>
    /// Application contracts describe intent, not queries: no <c>IQueryable</c>, <c>DbSet</c>, or
    /// EF namespace may appear on an Application abstraction in any context or the shared assembly.
    /// </summary>
    [Fact]
    public void Application_abstractions_do_not_expose_query_types()
    {
        var forbidden = new Regex(@"\b(IQueryable|DbSet|EntityFrameworkCore)\b", RegexOptions.Compiled);

        var abstractionRoots = Directory
            .EnumerateDirectories(RepoPaths.Combine("backend", "contexts"))
            .SelectMany(context => Directory.EnumerateDirectories(context, "*.Application"))
            .Append(RepoPaths.Combine("backend", "RealEstateEval.Application"))
            .Select(application => Path.Combine(application, "Abstractions"));

        var violations = abstractionRoots
            .SelectMany(RepoPaths.CSharpFiles)
            .Where(file => forbidden.IsMatch(File.ReadAllText(file)))
            .Select(RepoPaths.Relative)
            .ToList();

        Assert.True(
            violations.Count == 0,
            "Application abstractions expose EF query types. Return materialised lists, predicates "
            + "(Expression<Func<T, bool>>), or facts records instead:\n  "
            + string.Join("\n  ", violations));
    }

    private static IEnumerable<string> ProductionSourceFiles() =>
        new[]
            {
                RepoPaths.Combine("backend", "contexts"),
                RepoPaths.Combine("backend", "RealEstateEval.Infrastructure"),
                RepoPaths.Combine("backend", "RealEstateEval.Application"),
                RepoPaths.Combine("backend", "services"),
                RepoPaths.Combine("backend", "shared"),
            }
            .SelectMany(RepoPaths.CSharpFiles);
}
