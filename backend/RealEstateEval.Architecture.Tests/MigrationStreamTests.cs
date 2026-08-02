using System.Text.RegularExpressions;
using RealEstateEval.Architecture.Tests.Support;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Architecture.Tests;

/// <summary>
/// ADR 0003 and ADR 0006 guardrails for the migration architecture. Every stream belongs to
/// exactly one context, the legacy stream is frozen at the catalogued cutover, and only the
/// deploy-time migrator (or the development-only Case Study startup path) applies any of them.
/// </summary>
public class MigrationStreamTests
{
    private static readonly TableOwnershipCatalog Catalog = TableOwnershipCatalog.Instance;

    private static readonly string LegacyStream =
        RepoPaths.Combine("backend", "RealEstateEval.Infrastructure", "Data", "Migrations");

    private static readonly Regex TimestampedMigration = new(@"^\d{14}_", RegexOptions.Compiled);

    [Fact]
    public void EveryMigrationStreamIsCatalogued()
    {
        var directories = Directory
            .EnumerateDirectories(RepoPaths.Backend, "Migrations", SearchOption.AllDirectories)
            .Select(path => path.Replace('\\', '/'))
            .Where(path => !path.Contains("/obj/", StringComparison.Ordinal)
                && !path.Contains("/bin/", StringComparison.Ordinal))
            .Select(RepoPaths.Relative)
            .OrderBy(path => path, StringComparer.Ordinal)
            .ToArray();

        var catalogued = Catalog.Contexts
            .Select(context => context.Migrations)
            .OrderBy(path => path, StringComparer.Ordinal)
            .ToArray();

        Assert.Equal(catalogued, directories);
    }

    /// <summary>One snapshot per stream, and it belongs to that stream's context.</summary>
    [Fact]
    public void EveryStreamHasExactlyOneSnapshotForItsOwnContext()
    {
        var failures = new List<string>();

        foreach (var context in Catalog.Contexts)
        {
            var stream = RepoPaths.Combine(context.Migrations.Split('/'));
            var snapshots = Directory
                .EnumerateFiles(stream, "*ModelSnapshot.cs")
                .Select(Path.GetFileName)
                .Where(name => !TimestampedMigration.IsMatch(name!))
                .ToList();

            if (snapshots.Count != 1 || snapshots[0] != $"{context.Name}ModelSnapshot.cs")
            {
                failures.Add(
                    $"{context.Migrations} holds [{string.Join(", ", snapshots)}]; expected exactly "
                    + $"{context.Name}ModelSnapshot.cs.");
            }
        }

        Assert.True(failures.Count == 0, string.Join("\n  ", failures));
    }

    [Fact]
    public void EveryMigrationBelongsToItsOwnStreamsContext()
    {
        var attribute = new Regex(@"\[DbContext\(typeof\((\w+)\)\)\]", RegexOptions.Compiled);
        var offenders = new List<string>();

        foreach (var context in Catalog.Contexts)
        {
            var stream = RepoPaths.Combine(context.Migrations.Split('/'));
            foreach (var file in Directory.EnumerateFiles(stream, "*.cs"))
            {
                foreach (Match match in attribute.Matches(File.ReadAllText(file)))
                {
                    if (!string.Equals(match.Groups[1].Value, context.Name, StringComparison.Ordinal))
                        offenders.Add($"{RepoPaths.Relative(file)} -> {match.Groups[1].Value}");
                }
            }
        }

        Assert.True(
            offenders.Count == 0,
            "Migrations sit in another context's stream: " + string.Join(", ", offenders)
            + ". Each context owns its migrations assembly and history table (ADR 0003).");
    }

    /// <summary>
    /// Plan Phase 1, work item 5, as the catalog states it: the legacy stream is frozen for the
    /// schemas that have been extracted. A schema still on the legacy context may keep changing
    /// there — that is where its write path lives — but a legacy migration that reshaped an
    /// extracted schema would leave the two streams disagreeing about who shaped it last.
    /// </summary>
    [Fact]
    public void LegacyMigrationsAfterTheCutoverLeaveExtractedSchemasAlone()
    {
        var schemaLiteral = new Regex(@"(?:old)?[Ss]chema:\s*""(\w+)""", RegexOptions.Compiled);
        var extracted = Catalog.ExtractedContexts
            .SelectMany(context => context.Schemas)
            .ToHashSet(StringComparer.Ordinal);
        var failures = new List<string>();

        foreach (var file in Directory.EnumerateFiles(LegacyStream, "*.cs"))
        {
            var name = Path.GetFileNameWithoutExtension(file);
            if (name is null
                || !TimestampedMigration.IsMatch(name)
                || name.EndsWith(".Designer", StringComparison.Ordinal))
            {
                continue;
            }

            if (string.CompareOrdinal(name, BoundedContextMigrations.LegacyCutover) <= 0) continue;

            foreach (Match match in schemaLiteral.Matches(File.ReadAllText(file)))
            {
                if (extracted.Contains(match.Groups[1].Value))
                    failures.Add($"{name} shapes {match.Groups[1].Value}");
            }
        }

        Assert.True(
            failures.Count == 0,
            "Legacy migrations added after the cutover reshape an extracted context's schema: "
            + string.Join(", ", failures.Distinct(StringComparer.Ordinal))
            + ". That schema is shaped by its owner's stream now (ADR 0003).");
    }

    [Fact]
    public void MigrationsOnlyTouchKnownSchemas()
    {
        var schemaLiteral = new Regex(@"(?:old)?[Ss]chema:\s*""(\w+)""", RegexOptions.Compiled);
        var known = DatabaseSchemas.All
            .Concat(["public"])
            .ToHashSet(StringComparer.Ordinal);
        var unknown = new SortedSet<string>(StringComparer.Ordinal);

        foreach (var context in Catalog.Contexts)
        {
            var stream = RepoPaths.Combine(context.Migrations.Split('/'));
            foreach (var file in Directory.EnumerateFiles(stream, "*.cs"))
            {
                foreach (Match match in schemaLiteral.Matches(File.ReadAllText(file)))
                {
                    var schema = match.Groups[1].Value;
                    if (!known.Contains(schema))
                        unknown.Add($"{Path.GetFileName(file)}: {schema}");
                }
            }
        }

        Assert.True(
            unknown.Count == 0,
            "Migrations reference schemas that are not declared in DatabaseSchemas: "
            + string.Join(", ", unknown));
    }

    /// <summary>
    /// Plan Phase 1 exit criterion: no new migration touches another context's schema. An
    /// extracted context may only shape the schemas the catalog assigns to it.
    /// </summary>
    [Fact]
    public void ContextStreamsOnlyTouchTheirOwnSchemas()
    {
        var schemaLiteral = new Regex(@"(?:old)?[Ss]chema:\s*""(\w+)""", RegexOptions.Compiled);
        var failures = new List<string>();

        foreach (var context in Catalog.ExtractedContexts)
        {
            var owned = context.Schemas.ToHashSet(StringComparer.Ordinal);
            var stream = RepoPaths.Combine(context.Migrations.Split('/'));

            foreach (var file in Directory.EnumerateFiles(stream, "*.cs"))
            {
                if (file.EndsWith("ModelSnapshot.cs", StringComparison.Ordinal)
                    || file.EndsWith(".Designer.cs", StringComparison.Ordinal))
                {
                    continue;
                }

                foreach (Match match in schemaLiteral.Matches(File.ReadAllText(file)))
                {
                    if (!owned.Contains(match.Groups[1].Value))
                        failures.Add($"{RepoPaths.Relative(file)} shapes {match.Groups[1].Value}");
                }
            }
        }

        Assert.True(failures.Count == 0, string.Join("\n  ", failures));
    }

    [Fact]
    public void OnlyCaseStudyAppliesMigrationsFromAHost()
    {
        var offenders = new List<string>();

        foreach (var root in new[] { "services", "gateway", "shared" })
        {
            foreach (var file in RepoPaths.CSharpFiles(RepoPaths.Combine("backend", root)))
            {
                if (!File.ReadAllText(file).Contains("MigrateAsync", StringComparison.Ordinal)) continue;

                var relative = RepoPaths.Relative(file);
                if (!relative.Equals(
                    "backend/services/case-study/RealEstateEval.CaseStudy.Api/Program.cs",
                    StringComparison.Ordinal))
                {
                    offenders.Add(relative);
                }
            }
        }

        Assert.True(
            offenders.Count == 0,
            "Hosts other than the Case Study development path call MigrateAsync: "
            + string.Join(", ", offenders)
            + ". ADR 0006 makes schema change a deploy-time job (backend/tools/DbMigrate).");
    }

    /// <summary>
    /// The deploy migrator must apply every catalogued stream; a stream it does not know about
    /// silently never runs in production.
    /// </summary>
    [Fact]
    public void DeployMigratorAppliesTheLegacyStreamThenEveryContextStream()
    {
        var applyOrder = BoundedContextMigrations.ApplyOrder.Select(type => type.Name).ToList();
        var extracted = Catalog.ExtractedContexts
            .Select(context => context.Name)
            .OrderBy(name => name, StringComparer.Ordinal)
            .ToArray();

        Assert.Equal(extracted, applyOrder.OrderBy(name => name, StringComparer.Ordinal).ToArray());

        var migrator = File.ReadAllText(
            RepoPaths.Combine("backend", "tools", "DbMigrate", "Program.cs"));

        Assert.Contains(nameof(ApplicationDbContext), migrator, StringComparison.Ordinal);
        Assert.Contains(nameof(BoundedContextMigrations.ApplyOrder), migrator, StringComparison.Ordinal);
    }
}
