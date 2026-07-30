using RealEstateEval.Architecture.Tests.Support;

namespace RealEstateEval.Architecture.Tests;

/// <summary>
/// Split plan, Phase 0: "static checks that flag new cross-schema SQL/DbSets". The recorded
/// baseline is a ceiling — losing cross-schema access is always allowed, gaining it is not.
/// </summary>
public class SchemaAccessBoundaryTests
{
    private static readonly BoundaryBaseline Baseline = BoundaryBaseline.Load();

    [Fact]
    public void InfrastructureFilesDoNotReachNewSchemas()
    {
        var failures = new List<string>();

        foreach (var (file, schemas) in SourceFacts.SchemasByInfrastructureFile)
        {
            if (Baseline.InfrastructureFileSchemaAccess.TryGetValue(file, out var recorded))
            {
                var added = schemas.Except(recorded, StringComparer.Ordinal).ToList();
                if (added.Count > 0)
                    failures.Add($"{file} now also reads/writes: {string.Join(", ", added)}");
                continue;
            }

            // A new file may own one schema. Spanning two owners needs an approved decision.
            if (schemas.Count > 1)
                failures.Add($"{file} (new) spans schemas: {string.Join(", ", schemas)}");
        }

        Assert.True(
            failures.Count == 0,
            "New cross-schema data access was introduced:\n  "
            + string.Join("\n  ", failures)
            + "\nUse the owning service's interface, an integration event plus a local projection, "
            + "or record an approved exception in docs/architecture/boundary-baseline.json "
            + "(split plan, rule 2).");
    }

    [Fact]
    public void ApisDoNotReachNewSchemas()
    {
        var failures = new List<string>();

        foreach (var (api, schemas) in SourceFacts.SchemasByApi)
        {
            var recorded = Baseline.ApiSchemaAccess.TryGetValue(api, out var value) ? value : [];
            var added = schemas.Except(recorded, StringComparer.Ordinal).ToList();
            if (added.Count > 0)
                failures.Add($"{api} API now registers code that touches: {string.Join(", ", added)}");
        }

        Assert.True(
            failures.Count == 0,
            "A service gained access to another owner's schema:\n  "
            + string.Join("\n  ", failures)
            + "\nSchema-limited database roles (split plan, Phase 3) cannot be granted while this grows.");
    }

    [Fact]
    public void LegacyContextIsNotUsedInNewPlaces()
    {
        var added = SourceFacts.GodContextUsageOutsideInfrastructure
            .Except(Baseline.GodContextUsageOutsideInfrastructure, StringComparer.Ordinal)
            .ToList();

        Assert.True(
            added.Count == 0,
            "New direct use of ApplicationDbContext outside the Infrastructure project:\n  "
            + string.Join("\n  ", added)
            + "\nADR 0003 removes the shared context; hosts and tools must not add call sites to it.");
    }

    /// <summary>
    /// Split plan rule 1: one table has one write owner at every stage. A persistence service
    /// registered by several APIs means several processes write its tables, so the recorded
    /// fan-out may shrink but never grow.
    /// </summary>
    [Fact]
    public void PersistenceServicesAreNotRegisteredByMoreApisThanBefore()
    {
        var failures = new List<string>();

        foreach (var (type, apis) in SourceFacts.RegistrationFanOut)
        {
            var recorded = Baseline.ServiceRegistrationFanOut.TryGetValue(type, out var value)
                ? value
                : [];

            if (recorded.Count == 0)
            {
                if (apis.Count > 1)
                {
                    failures.Add(
                        $"{type} (new) is registered by {apis.Count} APIs: {string.Join(", ", apis)}");
                }

                continue;
            }

            var added = apis.Except(recorded, StringComparer.Ordinal).ToList();
            if (added.Count > 0)
                failures.Add($"{type} is now also registered by: {string.Join(", ", added)}");
        }

        Assert.True(
            failures.Count == 0,
            "A data-touching service gained another hosting process:\n  "
            + string.Join("\n  ", failures)
            + "\nGive the non-owner an owner API call or an event-fed projection instead "
            + "(split plan, rule 1).");
    }

    /// <summary>Reporting is a read model over upstream HTTP APIs and registers no persistence.</summary>
    [Fact]
    public void ReportingHasNoDirectDatabaseAccess() =>
        Assert.Empty(SourceFacts.SchemasByApi["reporting"]);

    /// <summary>
    /// An owner that cannot reach the schema it owns is a catalog mistake: Phase 1 would have
    /// to move behavior before it can move the write path.
    /// </summary>
    [Fact]
    public void EveryOwnerCanReachTheSchemaItOwns()
    {
        var apis = SourceFacts.SchemasByApi;
        var failures = new List<string>();

        foreach (var table in TableOwnershipCatalog.Instance.Tables)
        {
            if (!apis.TryGetValue(table.Owner, out var schemas)) continue; // per-producer/consumer
            if (!schemas.Contains(table.Schema, StringComparer.Ordinal))
                failures.Add($"{table.Owner} cannot reach {table.Schema} (owns {table.Table})");
        }

        Assert.True(failures.Count == 0, string.Join("\n  ", failures));
    }
}
