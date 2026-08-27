using RealEstateEval.Architecture.Tests.Support;

namespace RealEstateEval.Architecture.Tests;

/// <summary>
/// Shared-assembly coupling guardrails. The shared Application/Infrastructure/Domain assemblies are still
/// referenced by every API, so these tests freeze that coupling instead of pretending it is
/// gone: existing references are recorded, new ones fail.
/// </summary>
public class ProjectReferenceBoundaryTests
{
    private static readonly string[] GlobalAssemblies =
    [
        "RealEstateEval.Application.csproj",
        "RealEstateEval.Infrastructure.csproj",
    ];

    /// <summary>
    /// A10 cleanup: the global Domain assembly is retired — entities live in the context
    /// Domain libraries, shared wire types in the Shared.Contracts leaf. It must not return.
    /// </summary>
    [Fact]
    public void TheGlobalDomainProjectStaysRetired() =>
        Assert.False(
            Directory.Exists(RepoPaths.Combine("backend", "RealEstateEval.Domain")),
            "backend/RealEstateEval.Domain returned; entities belong to their context Domain "
            + "libraries and shared wire types to Shared.Contracts.");

    /// <summary>
    /// Context Domain libraries stay leaf-like: only the zero-reference contracts leaf
    /// (and, transitively, nothing else) may sit beneath an entity.
    /// </summary>
    [Fact]
    public void ContextDomainLibrariesReferenceOnlyTheSharedContractsLeaf()
    {
        var domainProjects = Directory
            .EnumerateFiles(RepoPaths.Combine("backend", "contexts"), "*.Domain.csproj", SearchOption.AllDirectories)
            .Select(RepoPaths.Relative);

        foreach (var project in domainProjects)
        {
            var stray = ReferencesOf(project)
                .Where(reference => !reference.EndsWith(
                    "RealEstateEval.Shared.Contracts.csproj", StringComparison.Ordinal))
                .ToList();
            Assert.True(
                stray.Count == 0,
                $"{project} references non-leaf projects: {string.Join(", ", stray)}.");
        }
    }

    [Fact]
    public void SharedContractsHasNoProjectReferences() =>
        Assert.Empty(ReferencesOf(
            "backend/shared/RealEstateEval.Shared.Contracts/RealEstateEval.Shared.Contracts.csproj"));

    [Fact]
    public void InfrastructureDoesNotDependOnHostingLibraries()
    {
        var references = ReferencesOf(
            "backend/RealEstateEval.Infrastructure/RealEstateEval.Infrastructure.csproj");

        Assert.DoesNotContain(references, reference =>
            reference.EndsWith("RealEstateEval.Shared.Web.csproj", StringComparison.Ordinal));
    }

    [Fact]
    public void GatewayDependsOnlyOnSharedHosting()
    {
        var references = ReferencesOf("backend/gateway/RealEstateEval.Gateway/RealEstateEval.Gateway.csproj");

        Assert.Equal(
            new[] { "backend/shared/RealEstateEval.Shared.Web/RealEstateEval.Shared.Web.csproj" },
            references.ToArray());
    }

    [Fact]
    public void ApiProjectsDoNotReferenceOtherApis()
    {
        foreach (var (project, references) in ServiceApiProjects())
        {
            foreach (var reference in references)
            {
                var isOtherApi = reference.StartsWith("backend/services/", StringComparison.Ordinal)
                    && !reference.Equals(project, StringComparison.Ordinal);
                Assert.False(
                    isOtherApi || reference.StartsWith("backend/gateway/", StringComparison.Ordinal),
                    $"{project} references {reference}. Services must integrate over HTTP or events, "
                    + "not by compiling another service's host.");
            }
        }
    }

 /// <summary>
 ///, "architecture tests that prohibit new service references to the
 /// global assemblies". Until a per-context replacement exists, the allowed set is exactly
 /// what docs/architecture/boundary-baseline.json records.
 /// </summary>
    [Fact]
    public void GlobalAssemblyReferencesDoNotGrow()
    {
        var baseline = BoundaryBaseline.Load().ProjectReferences;

        foreach (var (project, references) in SourceFacts.ProjectReferences)
        {
            var globalReferences = references.Where(IsGlobalAssembly).ToList();
            if (globalReferences.Count == 0) continue;

            var allowed = baseline.TryGetValue(project, out var recorded)
                ? recorded.Where(IsGlobalAssembly).ToList()
                : [];

            var added = globalReferences.Except(allowed, StringComparer.Ordinal).ToList();
            Assert.True(
                added.Count == 0,
                $"{project} added references to the shared assemblies: {string.Join(", ", added)}. "
                + "Shared assemblies should not gain new dependents without approval and recording "
                + "in docs/architecture/boundary-baseline.json.");
        }
    }

    private static bool IsGlobalAssembly(string reference) =>
        GlobalAssemblies.Any(name => reference.EndsWith(name, StringComparison.Ordinal));

    private static IEnumerable<KeyValuePair<string, IReadOnlyList<string>>> ServiceApiProjects() =>
        SourceFacts.ProjectReferences.Where(entry =>
            entry.Key.StartsWith("backend/services/", StringComparison.Ordinal));

    private static IReadOnlyList<string> ReferencesOf(string project)
    {
        Assert.True(
            SourceFacts.ProjectReferences.ContainsKey(project),
            $"Project '{project}' was not found; update the architecture tests if it moved.");
        return SourceFacts.ProjectReferences[project];
    }
}
