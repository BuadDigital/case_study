using System.Runtime.CompilerServices;

namespace RealEstateEval.Architecture.Tests.Support;

internal static class RepoPaths
{
    private const string SolutionMarker = "backend/RealEstateEval.slnx";

    public static string Root { get; } = ResolveRoot();

    public static string Backend => Combine("backend");

    public static string ArchitectureDocs => Combine("docs", "architecture");

    public static string Combine(params string[] parts) =>
        Path.Combine(new[] { Root }.Concat(parts).ToArray());

    /// <summary>Repository-relative, forward-slashed path used in baseline files.</summary>
    public static string Relative(string absolutePath) =>
        Path.GetRelativePath(Root, absolutePath).Replace('\\', '/');

    public static IReadOnlyList<string> CSharpFiles(string directory)
    {
        if (!Directory.Exists(directory)) return [];

        return Directory
            .EnumerateFiles(directory, "*.cs", SearchOption.AllDirectories)
            .Where(path => !IsGenerated(path))
            .OrderBy(Relative, StringComparer.Ordinal)
            .ToList();
    }

    private static bool IsGenerated(string path)
    {
        var normalized = path.Replace('\\', '/');
        return normalized.Contains("/bin/", StringComparison.Ordinal)
            || normalized.Contains("/obj/", StringComparison.Ordinal);
    }

    /// <summary>
    /// Walks up from the test binaries and, when they were built to an external artifacts
    /// path, from this file's compile-time location.
    /// </summary>
    private static string ResolveRoot()
    {
        foreach (var start in new[] { AppContext.BaseDirectory, SourceDirectory() })
        {
            var dir = start;
            while (!string.IsNullOrEmpty(dir))
            {
                if (File.Exists(Path.Combine(dir, SolutionMarker.Replace('/', Path.DirectorySeparatorChar))))
                    return dir;
                dir = Directory.GetParent(dir)?.FullName ?? "";
            }
        }

        throw new InvalidOperationException(
            $"Could not locate the repository root (looked for '{SolutionMarker}' above "
            + $"{AppContext.BaseDirectory} and {SourceDirectory()}).");
    }

    private static string SourceDirectory([CallerFilePath] string thisFile = "") =>
        Path.GetDirectoryName(thisFile) ?? "";
}
