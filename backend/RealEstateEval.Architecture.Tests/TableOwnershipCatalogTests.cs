using RealEstateEval.Architecture.Tests.Support;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Architecture.Tests;

/// <summary>
/// Phase 0 guardrails for docs/architecture-split-plan.md: every table mapped by the legacy
/// context must have exactly one catalogued owner, and no table may appear or move schema
/// without the catalog changing in the same commit.
/// </summary>
public class TableOwnershipCatalogTests
{
    private static readonly TableOwnershipCatalog Catalog = TableOwnershipCatalog.Instance;

    [Fact]
    public void CatalogCoversExactlyTheMappedTables()
    {
        var modelTables = EfModelFacts.SchemaByTable.Keys
            .OrderBy(name => name, StringComparer.Ordinal)
            .ToList();
        var catalogTables = Catalog.Tables
            .Select(table => table.Table)
            .OrderBy(name => name, StringComparer.Ordinal)
            .ToList();

        var missing = modelTables.Except(catalogTables, StringComparer.Ordinal).ToList();
        var stale = catalogTables.Except(modelTables, StringComparer.Ordinal).ToList();

        Assert.True(
            missing.Count == 0,
            "Tables are mapped by ApplicationDbContext but have no owner in "
            + $"docs/architecture/table-ownership.json: {string.Join(", ", missing)}. "
            + "Adding persistence requires naming its write owner (split plan, Phase 0).");
        Assert.True(
            stale.Count == 0,
            $"Catalog lists tables that the model no longer maps: {string.Join(", ", stale)}.");
    }

    [Fact]
    public void CatalogSchemasMatchTheModelAndTheDeclaredSchemaSet()
    {
        Assert.Equal(
            DatabaseSchemas.All.OrderBy(name => name, StringComparer.Ordinal),
            Catalog.Schemas.OrderBy(name => name, StringComparer.Ordinal));

        foreach (var table in Catalog.Tables)
        {
            Assert.True(
                EfModelFacts.SchemaByTable.TryGetValue(table.Table, out var modelSchema),
                $"{table.Table} is catalogued but not mapped.");
            Assert.True(
                string.Equals(modelSchema, table.Schema, StringComparison.Ordinal),
                $"{table.Table} is mapped to schema '{modelSchema}' but catalogued under "
                + $"'{table.Schema}'. Relocating a table is a data migration and needs an "
                + "approved ownership decision first (ADR 0003).");
        }
    }

    [Fact]
    public void EveryTableHasExactlyOneOwnerAndAKnownStatus()
    {
        var duplicates = Catalog.Tables
            .GroupBy(table => table.Table, StringComparer.Ordinal)
            .Where(group => group.Count() > 1)
            .Select(group => group.Key)
            .ToList();
        Assert.True(duplicates.Count == 0, $"Duplicate catalog rows: {string.Join(", ", duplicates)}.");

        foreach (var table in Catalog.Tables)
        {
            Assert.False(
                string.IsNullOrWhiteSpace(table.Owner),
                $"{table} has no owner.");
            Assert.Contains(table.OwnershipModel, Catalog.OwnershipModels);
            Assert.False(
                string.IsNullOrWhiteSpace(table.TransactionGroup),
                $"{table} has no transaction group; Phase 1 needs it to place the write path.");
            Assert.Contains(table.Status, Catalog.StatusValues);
        }
    }

    [Fact]
    public void PendingOwnershipRowsPointAtARecordedDecision()
    {
        var decisionIds = Catalog.Decisions.Select(decision => decision.Id).ToHashSet(StringComparer.Ordinal);

        foreach (var table in Catalog.Tables.Where(row =>
            string.Equals(row.Status, "pending-decision", StringComparison.Ordinal)))
        {
            Assert.False(
                string.IsNullOrWhiteSpace(table.Decision),
                $"{table} is pending a decision but does not name one.");
            Assert.Contains(table.Decision!, decisionIds);
        }
    }

    [Fact]
    public void EveryDbSetResolvesToACataloguedTable()
    {
        var catalogByTable = Catalog.Tables.ToDictionary(
            table => table.Table,
            table => table,
            StringComparer.Ordinal);

        foreach (var (dbSet, table) in EfModelFacts.TableByDbSet)
        {
            Assert.True(
                catalogByTable.ContainsKey(table),
                $"DbSet '{dbSet}' maps table '{table}', which has no catalogued owner.");

            var catalogued = catalogByTable[table];
            if (!string.IsNullOrEmpty(catalogued.DbSet))
            {
                Assert.True(
                    string.Equals(catalogued.DbSet, dbSet, StringComparison.Ordinal),
                    $"Table '{table}' is catalogued against DbSet '{catalogued.DbSet}' but exposed "
                    + $"as '{dbSet}'.");
            }
        }
    }

    /// <summary>
    /// Plan rule 7: a phase starts only when the preceding phase's exit criteria are met. Every
    /// open decision must therefore carry its outcome, and D6 — the production-consumer
    /// inventory that repository inspection cannot produce — must say so explicitly rather than
    /// be quietly closed.
    /// </summary>
    [Fact]
    public void EveryDecisionIsResolvedBeforePhaseOne()
    {
        var unresolved = Catalog.Decisions
            .Where(decision => string.Equals(decision.Status, "open", StringComparison.Ordinal)
                || string.IsNullOrWhiteSpace(decision.Outcome)
                || string.IsNullOrWhiteSpace(decision.Rationale))
            .Select(decision => decision.Id)
            .ToList();

        Assert.True(
            unresolved.Count == 0,
            "Ownership decisions without a recorded outcome and rationale: "
            + string.Join(", ", unresolved)
            + ". Phase 1 may not proceed on an undocumented ownership call.");

        Assert.Contains(
            Catalog.Decisions,
            decision => string.Equals(decision.Status, "accepted-with-residual-risk", StringComparison.Ordinal));
    }

    /// <summary>
    /// The legacy stream is frozen at the cutover the catalog names, and the deploy migrator
    /// applies it before any context stream (ADR 0006).
    /// </summary>
    [Fact]
    public void CataloguedCutoverMatchesTheCode() =>
        Assert.Equal(BoundedContextMigrations.LegacyCutover, Catalog.LegacyMigrationCutover);
}
