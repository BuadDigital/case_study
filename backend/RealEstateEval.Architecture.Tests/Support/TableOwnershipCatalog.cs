using System.Text.Json;
using System.Text.Json.Serialization;

namespace RealEstateEval.Architecture.Tests.Support;

/// <summary>Reads the ownership catalog (docs/architecture/table-ownership.json).</summary>
internal sealed class TableOwnershipCatalog
{
    private static readonly JsonSerializerOptions SerializerOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
        ReadCommentHandling = JsonCommentHandling.Skip,
        DefaultIgnoreCondition = JsonIgnoreCondition.Never,
    };

    private static readonly Lazy<TableOwnershipCatalog> Lazy = new(Load);

    public const string LegacyContextName = "ApplicationDbContext";

    public static TableOwnershipCatalog Instance => Lazy.Value;

    public static string Path { get; } =
        System.IO.Path.Combine(RepoPaths.ArchitectureDocs, "table-ownership.json");

    public int Version { get; set; }

    public string CapturedOn { get; set; } = "";

    public string Phase { get; set; } = "";

    public List<string> StatusValues { get; set; } = [];

    public List<string> OwnershipModels { get; set; } = [];

 /// <summary>Last legacy migration the deploy migrator applies before any context stream.</summary>
    public string LegacyMigrationCutover { get; set; } = "";

    public List<string> Schemas { get; set; } = [];

    public List<BoundedContext> Contexts { get; set; } = [];

    public List<OwnershipDecision> Decisions { get; set; } = [];

    public List<TableOwnership> Tables { get; set; } = [];

    public bool FullyApproved =>
        Tables.Count > 0
        && Tables.All(table => string.Equals(table.Status, "approved", StringComparison.Ordinal));

 /// <summary>Contexts that already hold a write path of their own (everything but the legacy one).</summary>
    public IEnumerable<BoundedContext> ExtractedContexts =>
        Contexts.Where(context => string.Equals(context.State, "extracted", StringComparison.Ordinal));

    public IEnumerable<TableOwnership> TablesOwnedBy(string contextName) =>
        Tables.Where(table => table.Contexts.Contains(contextName, StringComparer.Ordinal));

    private static TableOwnershipCatalog Load()
    {
        if (!File.Exists(Path))
            throw new FileNotFoundException("Ownership catalog missing.", Path);

        return JsonSerializer.Deserialize<TableOwnershipCatalog>(
                File.ReadAllText(Path),
                SerializerOptions)
            ?? throw new InvalidOperationException($"Could not parse {Path}.");
    }

    internal sealed class TableOwnership
    {
        public string Table { get; set; } = "";
        public string Schema { get; set; } = "";
        public string? DbSet { get; set; }
        public string Entity { get; set; } = "";
        public string Owner { get; set; } = "";
        public string Status { get; set; } = "";
        public string OwnershipModel { get; set; } = "";
        public List<string> Contexts { get; set; } = [];
        public string TransactionGroup { get; set; } = "";
        public string? Decision { get; set; }
        public string? Note { get; set; }

 /// <summary>Messaging rows are owned per producing/consuming service, not per table.</summary>
        public bool IsSharedInfrastructureTable =>
            !string.Equals(OwnershipModel, "single-owner", StringComparison.Ordinal);

        public override string ToString() => $"{Schema}.{Table}";
    }

    internal sealed class BoundedContext
    {
        public string Name { get; set; } = "";
        public string State { get; set; } = "";
        public string? Owner { get; set; }
        public List<string> Schemas { get; set; } = [];
        public string Migrations { get; set; } = "";
        public string? MigrationsHistorySchema { get; set; }
        public string? Note { get; set; }

        public override string ToString() => Name;
    }

    internal sealed class OwnershipDecision
    {
        public string Id { get; set; } = "";
        public string Question { get; set; } = "";
        public List<string> Candidates { get; set; } = [];
        public string Input { get; set; } = "";
        public string Status { get; set; } = "";
        public string? DecidedOn { get; set; }
        public string? Outcome { get; set; }
        public string? Rationale { get; set; }
        public string? Note { get; set; }
    }
}
