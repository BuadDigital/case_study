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

    [Fact]
    public void ModelMatchesTheMigrationSnapshot()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql("Host=architecture-tests;Database=model_only;Username=none;Password=none")
            .Options;

        using var context = new ApplicationDbContext(options);

        Assert.False(
            context.Database.HasPendingModelChanges(),
            "The model differs from ApplicationDbContextModelSnapshot. The legacy migration "
            + "stream is the baseline that the deploy-time migrator applies before any "
 + "per-context stream (migration-stream rules), so it must never drift.");
    }
}
