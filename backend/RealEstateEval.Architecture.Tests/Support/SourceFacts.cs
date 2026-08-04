using System.Text.RegularExpressions;
using System.Xml.Linq;

namespace RealEstateEval.Architecture.Tests.Support;

/// <summary>
/// Static facts derived from the repository sources: the project-reference graph, which
/// schemas each file reaches through the shared context, and which implementations each API
/// registers. These are deliberately syntactic: the guardrails must work without a database
/// and without loading every API assembly.
/// </summary>
internal static class SourceFacts
{
    // Field aliases for ApplicationDbContext and extracted bounded-context fields after A6
    // cutovers (`_ops`, `_caseStudy`, `_financial`, …). Extending here keeps schema fan-out
    // detection accurate without forcing every service back onto `_db`.
    private static readonly Regex ContextMemberAccess = new(
        @"\b(?:_db|db|_context|context|dbContext|_dbContext|_ops|_cs|_fin|_caseStudy|_financial|_identity|_attachments|_failures|_platform|_valuation|_messaging)\.(\w+)\b",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    private static readonly Regex GenericSetAccess = new(
        @"\.Set<(\w+)>\s*\(",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    private static readonly Regex TypeDeclaration = new(
        @"\b(?:class|record)\s+(\w+)",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    private static readonly Regex RegistrationMethod = new(
        @"public\s+static\s+IServiceCollection\s+(\w+)\s*\(",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    private static readonly Regex ServiceRegistration = new(
        @"\.Add(?:Scoped|Singleton|Transient)<([^>;()]+)>",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    private static readonly Regex HostedServiceRegistration = new(
        @"\.AddHostedService<(\w+)>",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    private static readonly Regex ExtensionCall = new(
        @"\.(Add[A-Z]\w*)\s*\(",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    private static readonly Lazy<Dictionary<string, string>> RegistrationBodies =
        new(ReadRegistrationBodies);

    private static readonly Lazy<Dictionary<string, string>> FilesByType = new(BuildFilesByType);

    public static IReadOnlyList<string> ApiNames { get; } = DiscoverApis();

    /// <summary>Project file (repo-relative) to its project references (repo-relative).</summary>
    public static IReadOnlyDictionary<string, IReadOnlyList<string>> ProjectReferences { get; } =
        BuildProjectReferences();

    /// <summary>Infrastructure source file (repo-relative) to the schemas it reaches.</summary>
    public static IReadOnlyDictionary<string, IReadOnlyList<string>> SchemasByInfrastructureFile { get; } =
        BuildSchemasByFile(RepoPaths.Combine("backend", "RealEstateEval.Infrastructure"));

    /// <summary>Service name (folder under backend/services) to the schemas its registrations reach.</summary>
    public static IReadOnlyDictionary<string, IReadOnlyList<string>> SchemasByApi { get; } =
        BuildSchemasByApi();

    /// <summary>
    /// Data-touching implementation type to the APIs that register it. Anything registered by
    /// more than one API is a table with more than one writing process today.
    /// </summary>
    public static IReadOnlyDictionary<string, IReadOnlyList<string>> RegistrationFanOut { get; } =
        BuildRegistrationFanOut();

    /// <summary>
    /// Files outside the Infrastructure project that name the legacy god context directly.
    /// Every entry is a place that must be re-pointed when contexts are split.
    /// </summary>
    public static IReadOnlyList<string> GodContextUsageOutsideInfrastructure { get; } =
        BuildGodContextUsage();

    public static IReadOnlyList<string> SchemasInFile(string absolutePath)
    {
        var text = File.ReadAllText(absolutePath);
        var schemas = new SortedSet<string>(StringComparer.Ordinal);

        foreach (Match match in ContextMemberAccess.Matches(text))
        {
            var schema = EfModelFacts.SchemaForDbSet(match.Groups[1].Value);
            if (!string.IsNullOrEmpty(schema)) schemas.Add(schema);
        }

        foreach (Match match in GenericSetAccess.Matches(text))
        {
            if (EfModelFacts.SchemaByEntityName.TryGetValue(match.Groups[1].Value, out var schema)
                && !string.IsNullOrEmpty(schema))
            {
                schemas.Add(schema);
            }
        }

        return schemas.ToList();
    }

    private static List<string> BuildGodContextUsage()
    {
        var roots = new[] { "services", "gateway", "shared", "tools", "scripts" };
        var hits = new SortedSet<string>(StringComparer.Ordinal);

        foreach (var root in roots)
        {
            foreach (var file in RepoPaths.CSharpFiles(RepoPaths.Combine("backend", root)))
            {
                if (File.ReadAllText(file).Contains("ApplicationDbContext", StringComparison.Ordinal))
                    hits.Add(RepoPaths.Relative(file));
            }
        }

        return hits.ToList();
    }

    private static List<string> DiscoverApis() =>
        Directory
            .EnumerateDirectories(RepoPaths.Combine("backend", "services"))
            .Select(Path.GetFileName)
            .Where(name => !string.IsNullOrEmpty(name))
            .Select(name => name!)
            .OrderBy(name => name, StringComparer.Ordinal)
            .ToList();

    private static Dictionary<string, IReadOnlyList<string>> BuildProjectReferences()
    {
        var result = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal);
        var projectFiles = Directory
            .EnumerateFiles(RepoPaths.Backend, "*.csproj", SearchOption.AllDirectories)
            .Where(path => !path.Replace('\\', '/').Contains("/obj/", StringComparison.Ordinal));

        foreach (var projectFile in projectFiles)
        {
            var projectDirectory = Path.GetDirectoryName(projectFile)!;
            var references = XDocument
                .Load(projectFile)
                .Descendants("ProjectReference")
                .Select(element => element.Attribute("Include")?.Value)
                .Where(value => !string.IsNullOrWhiteSpace(value))
                .Select(value => Path.GetFullPath(
                    Path.Combine(projectDirectory, value!.Replace('\\', Path.DirectorySeparatorChar))))
                .Select(RepoPaths.Relative)
                .OrderBy(value => value, StringComparer.Ordinal)
                .ToList();

            result[RepoPaths.Relative(projectFile)] = references;
        }

        return result;
    }

    private static Dictionary<string, IReadOnlyList<string>> BuildSchemasByFile(string root)
    {
        var result = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal);
        foreach (var file in RepoPaths.CSharpFiles(root))
        {
            if (file.Replace('\\', '/').Contains("/Data/Migrations/", StringComparison.Ordinal))
                continue;

            var schemas = SchemasInFile(file);
            if (schemas.Count > 0)
                result[RepoPaths.Relative(file)] = schemas;
        }

        return result;
    }

    private static Dictionary<string, IReadOnlyList<string>> BuildRegistrationFanOut()
    {
        var registrationBodies = RegistrationBodies.Value;
        var filesByType = FilesByType.Value;
        var apisByType = new SortedDictionary<string, SortedSet<string>>(StringComparer.Ordinal);

        foreach (var api in ApiNames)
        {
            var apiDirectory = RepoPaths.Combine("backend", "services", api);
            foreach (var type in ResolveRegisteredTypes(apiDirectory, registrationBodies))
            {
                if (!filesByType.TryGetValue(type, out var file)) continue;
                if (SchemasInFile(file).Count == 0) continue;

                if (!apisByType.TryGetValue(type, out var apis))
                    apisByType[type] = apis = new SortedSet<string>(StringComparer.Ordinal);
                apis.Add(api);
            }
        }

        return apisByType.ToDictionary(
            entry => entry.Key,
            entry => (IReadOnlyList<string>)entry.Value.ToList(),
            StringComparer.Ordinal);
    }

    private static Dictionary<string, IReadOnlyList<string>> BuildSchemasByApi()
    {
        var registrationBodies = RegistrationBodies.Value;
        var filesByType = FilesByType.Value;
        var result = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal);

        foreach (var api in ApiNames)
        {
            var apiDirectory = RepoPaths.Combine("backend", "services", api);
            var schemas = new SortedSet<string>(StringComparer.Ordinal);

            // Code that lives in the API project itself (controllers, consumers, startup).
            foreach (var file in RepoPaths.CSharpFiles(apiDirectory))
                foreach (var schema in SchemasInFile(file))
                    schemas.Add(schema);

            foreach (var type in ResolveRegisteredTypes(apiDirectory, registrationBodies))
            {
                if (!filesByType.TryGetValue(type, out var file)) continue;
                foreach (var schema in SchemasInFile(file))
                    schemas.Add(schema);
            }

            result[api] = schemas.ToList();
        }

        return result;
    }

    private static SortedSet<string> ResolveRegisteredTypes(
        string apiDirectory,
        IReadOnlyDictionary<string, string> registrationBodies)
    {
        var types = new SortedSet<string>(StringComparer.Ordinal);
        var visitedMethods = new HashSet<string>(StringComparer.Ordinal);
        var pending = new Queue<string>();

        foreach (var file in RepoPaths.CSharpFiles(apiDirectory))
        {
            var text = File.ReadAllText(file);
            foreach (Match match in ExtensionCall.Matches(text))
                pending.Enqueue(match.Groups[1].Value);
            foreach (Match match in HostedServiceRegistration.Matches(text))
                types.Add(match.Groups[1].Value);
        }

        while (pending.Count > 0)
        {
            var method = pending.Dequeue();
            if (!visitedMethods.Add(method)) continue;
            if (!registrationBodies.TryGetValue(method, out var body)) continue;

            foreach (Match match in ServiceRegistration.Matches(body))
            {
                var implementation = match.Groups[1].Value
                    .Split(',')
                    .Last()
                    .Trim();
                if (implementation.Length > 0 && !implementation.Contains('<'))
                    types.Add(implementation);
            }

            foreach (Match match in HostedServiceRegistration.Matches(body))
                types.Add(match.Groups[1].Value);

            foreach (Match match in ExtensionCall.Matches(body))
                pending.Enqueue(match.Groups[1].Value);
        }

        return types;
    }

    private static Dictionary<string, string> ReadRegistrationBodies()
    {
        var path = RepoPaths.Combine(
            "backend",
            "RealEstateEval.Infrastructure",
            "DependencyInjection.cs");
        var text = File.ReadAllText(path);
        var bodies = new Dictionary<string, string>(StringComparer.Ordinal);

        foreach (Match match in RegistrationMethod.Matches(text))
        {
            var bodyStart = text.IndexOf('{', match.Index + match.Length);
            if (bodyStart < 0) continue;

            var depth = 0;
            var end = bodyStart;
            for (; end < text.Length; end++)
            {
                if (text[end] == '{') depth++;
                else if (text[end] == '}')
                {
                    depth--;
                    if (depth == 0) break;
                }
            }

            bodies[match.Groups[1].Value] = text[bodyStart..Math.Min(end + 1, text.Length)];
        }

        return bodies;
    }

    private static Dictionary<string, string> BuildFilesByType()
    {
        var result = new Dictionary<string, string>(StringComparer.Ordinal);
        var roots = new[]
        {
            RepoPaths.Combine("backend", "RealEstateEval.Infrastructure"),
            RepoPaths.Combine("backend", "RealEstateEval.Application"),
        };

        foreach (var root in roots)
        {
            foreach (var file in RepoPaths.CSharpFiles(root))
            {
                var text = File.ReadAllText(file);
                foreach (Match match in TypeDeclaration.Matches(text))
                    result.TryAdd(match.Groups[1].Value, file);
            }
        }

        return result;
    }
}
