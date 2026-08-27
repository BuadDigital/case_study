using Microsoft.EntityFrameworkCore;
using RealEstateEval.Architecture.Tests.Support;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Architecture.Tests;

/// <summary>
/// Model-level boundary facts. Cross-schema relationships are the coupling that has to be
/// removed before a database can be split, so they are inventoried and frozen.
/// </summary>
public class EfModelBoundaryTests
{
    private static readonly BoundaryBaseline Baseline = BoundaryBaseline.Load();

    [Fact]
    public void EveryMappedTableDeclaresASchema()
    {
        var unqualified = EfModelFacts.SchemaByTable
            .Where(entry => string.IsNullOrEmpty(entry.Value))
            .Select(entry => entry.Key)
            .ToList();

        Assert.True(
            unqualified.Count == 0,
            "Tables mapped without an explicit schema (they would land in 'public' and belong to "
            + $"nobody): {string.Join(", ", unqualified)}. Use DatabaseSchemas.");
    }

    [Fact]
    public void NoNewCrossSchemaForeignKeys()
    {
        var added = EfModelFacts.CrossSchemaForeignKeys
            .Except(Baseline.CrossSchemaForeignKeys, StringComparer.Ordinal)
            .ToList();

        Assert.True(
            added.Count == 0,
            "New cross-schema foreign keys:\n  "
            + string.Join("\n  ", added)
 + "\n rule 2 forbids them: a foreign key across owners cannot survive a "
            + "database split.");
    }

    [Fact]
    public void NoNewCrossSchemaNavigations()
    {
        var added = EfModelFacts.CrossSchemaNavigations
            .Except(Baseline.CrossSchemaNavigations, StringComparer.Ordinal)
            .ToList();

        Assert.True(
            added.Count == 0,
            "New cross-schema navigation properties:\n  "
            + string.Join("\n  ", added)
            + "\nThese generate cross-owner joins. Read through the owner instead.");
    }

    // A10: the legacy-snapshot drift test is retired with the legacy context. Owner-stream
    // snapshot drift is caught per stream by MigrationStreamTests and the container suite
    // (EF10 fails MigrateAsync on PendingModelChangesWarning), and shared-mapping drift by
    // the consistency checks inside EfModelFacts.
}
