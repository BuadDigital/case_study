using System.Text.RegularExpressions;
using RealEstateEval.Architecture.Tests.Support;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Architecture.Tests;

/// <summary>
/// Phase-1 guardrails: the ownership catalog is approved, so contexts may now be split, and the
/// catalog becomes the specification each context is checked against. A context that maps a
/// table it does not own is the failure mode these tests exist to catch — it silently recreates
/// the shared model the split is meant to remove.
/// </summary>
public class BoundedContextBoundaryTests
{
    private static readonly TableOwnershipCatalog Catalog = TableOwnershipCatalog.Instance;

    [Fact]
    public void OwnershipIsApprovedBeforeAnyContextIsExtracted()
    {
        if (Catalog.ExtractedContexts.Any())
        {
            Assert.True(
                Catalog.FullyApproved,
                "Contexts are marked extracted while table ownership is still proposed or pending. "
                + "Plan rule 7: Phase 1 starts only after Phase 0's exit criteria are met.");
        }
    }

    [Fact]
    public void DeclaredContextsAreExactlyTheCataloguedOnes()
    {
        // Primary constructors put `(DbContextOptions<...>)` between the name and the base.
        // Identity's context inherits ASP.NET Identity's IdentityDbContext<TUser>.
        var declaration = new Regex(
            @"class\s+(\w+)(?:\s*\([^)]*\))?\s*:\s*(?:Microsoft\.(?:EntityFrameworkCore|AspNetCore\.Identity\.EntityFrameworkCore)\.)?(?:DbContext|IdentityDbContext)\b",
            RegexOptions.Compiled);

        var declared = new SortedSet<string>(StringComparer.Ordinal);
        foreach (var root in new[] { "RealEstateEval.Infrastructure", "services", "shared", "gateway" })
        {
            foreach (var file in RepoPaths.CSharpFiles(RepoPaths.Combine("backend", root)))
            {
                foreach (Match match in declaration.Matches(File.ReadAllText(file)))
                    declared.Add(match.Groups[1].Value);
            }
        }

        var catalogued = Catalog.Contexts
            .Select(context => context.Name)
            .OrderBy(name => name, StringComparer.Ordinal)
            .ToArray();

        Assert.Equal(catalogued, declared.ToArray());
    }

    /// <summary>
    /// Plan Phase 1, work item 1: "initially map existing table and schema names". A context
    /// that maps more than it owns would put a second writer back on someone else's table.
    /// </summary>
    [Fact]
    public void ExtractedContextsMapExactlyTheTablesTheyOwn()
    {
        var failures = new List<string>();

        foreach (var context in Catalog.ExtractedContexts)
        {
            var expected = Catalog.TablesOwnedBy(context.Name)
                .Select(table => $"{table.Schema}.{table.Table}")
                .OrderBy(name => name, StringComparer.Ordinal)
                .ToList();

            var actual = BoundedContextFacts.TablesByContext.TryGetValue(context.Name, out var mapped)
                ? mapped
                : [];

            var extra = actual.Except(expected, StringComparer.Ordinal).ToList();
            var missing = expected.Except(actual, StringComparer.Ordinal).ToList();

            if (extra.Count > 0)
                failures.Add($"{context.Name} maps tables it does not own: {string.Join(", ", extra)}");
            if (missing.Count > 0)
                failures.Add($"{context.Name} does not map: {string.Join(", ", missing)}");
        }

        Assert.True(failures.Count == 0, string.Join("\n  ", failures));
    }

    /// <summary>
    /// Plan Phase 1 exit criterion: every table is writable through exactly one context. Only
    /// the messaging tables are exempt, because D5 makes their rows — not the table — owned.
    /// </summary>
    [Fact]
    public void EveryTableHasExactlyOneWritingContext()
    {
        var failures = new List<string>();

        foreach (var table in Catalog.Tables)
        {
            if (table.Contexts.Count == 0)
            {
                failures.Add($"{table} names no context; its write path is untracked.");
                continue;
            }

            if (table.Contexts.Count > 1 && !table.IsSharedInfrastructureTable)
            {
                failures.Add(
                    $"{table} is mapped by {string.Join(", ", table.Contexts)} but is "
                    + "single-owner. Only per-producer/per-consumer messaging tables may appear "
                    + "in several contexts (D5).");
            }

            foreach (var name in table.Contexts)
            {
                if (!BoundedContextFacts.TablesByContext.ContainsKey(name))
                    failures.Add($"{table} names unknown context '{name}'.");
            }
        }

        Assert.True(failures.Count == 0, string.Join("\n  ", failures));
    }

    /// <summary>
    /// Plan Phase 1, work item 3: unmoved slices stay on the legacy context and no new mapping
    /// is added to it. Extracted tables keep their legacy mapping only so non-owner slices can
    /// still read them; the write path has moved, and Phase 3 removes the read.
    /// </summary>
    [Fact]
    public void ExtractedTablesAreNoLongerWrittenThroughTheLegacyContext()
    {
        var extractedSchemas = Catalog.ExtractedContexts
            .SelectMany(context => context.Schemas)
            .ToHashSet(StringComparer.Ordinal);

        var owningServices = new[]
        {
            "AttachmentService",
            "CourtsService",
            "CourtsCatalogService",
            "RegionsService",
            "FieldDictionaryService",
            "CaseStudyInfoRolesConfigService",
            "FailureTypesCatalogService",
            "SurveyOfficesService",
            "NotificationService",
            "PushSubscriptionService",
            "ValuationRequestService",
            "EvaluatorRecallsService",
            "AuthSessionService",
            "UserRegistrationService",
            "PermissionService",
        };

        var failures = new List<string>();
        foreach (var service in owningServices)
        {
            var file = RepoPaths.Combine(
                "backend",
                "RealEstateEval.Infrastructure",
                "Services",
                service + ".cs");

            Assert.True(File.Exists(file), $"{service} moved; update this guardrail.");

            if (File.ReadAllText(file).Contains(nameof(ApplicationDbContext), StringComparison.Ordinal))
                failures.Add($"{service} still takes the legacy context");
        }

        Assert.True(
            failures.Count == 0,
            "Services that own an extracted schema must resolve their own context:\n  "
            + string.Join("\n  ", failures)
            + $"\nExtracted schemas: {string.Join(", ", extractedSchemas.Order(StringComparer.Ordinal))}.");
    }

    /// <summary>
    /// Plan Phase 1, work item 5. Sharing one history table would let a context claim another's
    /// migrations as applied, which is unrecoverable once the databases are actually separate.
    /// </summary>
    [Fact]
    public void EachExtractedContextRecordsMigrationsInItsOwnSchema()
    {
        var failures = new List<string>();
        var schemas = new HashSet<string>(StringComparer.Ordinal);

        foreach (var context in Catalog.ExtractedContexts)
        {
            if (!BoundedContextFacts.HistorySchemaByContext.TryGetValue(context.Name, out var schema))
            {
                failures.Add($"{context.Name} has no migrations-history schema in code.");
                continue;
            }

            if (!string.Equals(schema, context.MigrationsHistorySchema, StringComparison.Ordinal))
            {
                failures.Add(
                    $"{context.Name} records history in '{schema}' but the catalog says "
                    + $"'{context.MigrationsHistorySchema}'.");
            }

            if (!schemas.Add(schema))
                failures.Add($"{context.Name} shares its history table with another context.");
        }

        Assert.True(failures.Count == 0, string.Join("\n  ", failures));
    }
}
