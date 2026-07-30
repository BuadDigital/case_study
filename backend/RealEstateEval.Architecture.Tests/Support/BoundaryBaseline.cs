using System.Text.Json;
using System.Text.Json.Serialization;

namespace RealEstateEval.Architecture.Tests.Support;

/// <summary>
/// Recorded coupling that exists today. The guardrails treat it as a ceiling: coupling may
/// shrink freely, but growing it fails a test until the baseline is updated deliberately.
/// Regenerate with <c>REE_ARCH_BASELINE=update dotnet test</c> and review the diff.
/// </summary>
internal sealed class BoundaryBaseline
{
    public const string UpdateEnvironmentVariable = "REE_ARCH_BASELINE";

    private static readonly JsonSerializerOptions SerializerOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
        WriteIndented = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.Never,
        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

    public string Note { get; set; } = "";

    public Dictionary<string, List<string>> ProjectReferences { get; set; } = new(StringComparer.Ordinal);

    public Dictionary<string, List<string>> ApiSchemaAccess { get; set; } = new(StringComparer.Ordinal);

    public Dictionary<string, List<string>> InfrastructureFileSchemaAccess { get; set; } =
        new(StringComparer.Ordinal);

    public Dictionary<string, List<string>> ServiceRegistrationFanOut { get; set; } =
        new(StringComparer.Ordinal);

    public List<string> CrossSchemaForeignKeys { get; set; } = [];

    public List<string> CrossSchemaNavigations { get; set; } = [];

    public List<string> GodContextUsageOutsideInfrastructure { get; set; } = [];

    public static string Path { get; } =
        System.IO.Path.Combine(RepoPaths.ArchitectureDocs, "boundary-baseline.json");

    public static bool UpdateRequested =>
        string.Equals(
            Environment.GetEnvironmentVariable(UpdateEnvironmentVariable),
            "update",
            StringComparison.OrdinalIgnoreCase);

    public static BoundaryBaseline Load()
    {
        if (!File.Exists(Path))
        {
            if (UpdateRequested) return Current();

            throw new FileNotFoundException(
                $"Boundary baseline missing. Generate it with {UpdateEnvironmentVariable}=update dotnet test.",
                Path);
        }

        return JsonSerializer.Deserialize<BoundaryBaseline>(File.ReadAllText(Path), SerializerOptions)
            ?? throw new InvalidOperationException($"Could not parse {Path}.");
    }

    public static BoundaryBaseline Current() => new()
    {
        Note = "Generated from the repository by RealEstateEval.Architecture.Tests. "
            + "It records the coupling that exists today so the guardrails can prevent growth. "
            + "Entries may only be added together with an approved ownership change in "
            + "docs/architecture/table-ownership.json.",
        ProjectReferences = SourceFacts.ProjectReferences
            .ToDictionary(entry => entry.Key, entry => entry.Value.ToList(), StringComparer.Ordinal),
        ApiSchemaAccess = SourceFacts.SchemasByApi
            .ToDictionary(entry => entry.Key, entry => entry.Value.ToList(), StringComparer.Ordinal),
        InfrastructureFileSchemaAccess = SourceFacts.SchemasByInfrastructureFile
            .ToDictionary(entry => entry.Key, entry => entry.Value.ToList(), StringComparer.Ordinal),
        ServiceRegistrationFanOut = SourceFacts.RegistrationFanOut
            .ToDictionary(entry => entry.Key, entry => entry.Value.ToList(), StringComparer.Ordinal),
        CrossSchemaForeignKeys = EfModelFacts.CrossSchemaForeignKeys.ToList(),
        CrossSchemaNavigations = EfModelFacts.CrossSchemaNavigations.ToList(),
        GodContextUsageOutsideInfrastructure = SourceFacts.GodContextUsageOutsideInfrastructure.ToList(),
    };

    public void Save()
    {
        Directory.CreateDirectory(RepoPaths.ArchitectureDocs);
        File.WriteAllText(Path, JsonSerializer.Serialize(this, SerializerOptions) + Environment.NewLine);
    }
}
