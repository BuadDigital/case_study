using System.Text.RegularExpressions;
using RealEstateEval.Architecture.Tests.Support;

namespace RealEstateEval.Architecture.Tests;

/// <summary>
/// C10: controllers declare unversioned <c>api/...</c> templates only.
/// <c>CanonicalV1AliasConvention</c> adds the <c>/v1</c> compatibility alias.
/// </summary>
public class ApiRouteVersioningTests
{
    private static readonly Regex AttributeTemplate = new(
        @"\[(?:Route|Http(?:Get|Post|Put|Patch|Delete))\(\s*""([^""]+)""",
        RegexOptions.Compiled);

    [Fact]
    public void Controllers_do_not_declare_explicit_v1_route_templates()
    {
        var servicesRoot = RepoPaths.Combine("backend", "services");
        var violations = new List<string>();

        foreach (var file in RepoPaths.CSharpFiles(servicesRoot))
        {
            if (!file.EndsWith("Controller.cs", StringComparison.OrdinalIgnoreCase)
                && !file.Replace('\\', '/').Contains("/Controllers/", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            var text = File.ReadAllText(file);
            foreach (Match match in AttributeTemplate.Matches(text))
            {
                var template = match.Groups[1].Value;
                var body = template.StartsWith("~/", StringComparison.Ordinal)
                    ? template[2..]
                    : template.TrimStart('/');
                var hasV1 = body
                    .Split('/', StringSplitOptions.RemoveEmptyEntries)
                    .Any(segment =>
                        !segment.StartsWith('{')
                        && segment.Equals("v1", StringComparison.OrdinalIgnoreCase));
                if (hasV1)
                    violations.Add($"{RepoPaths.Relative(file)}: {template}");
            }
        }

        Assert.True(
            violations.Count == 0,
            "Declare the canonical unversioned template only; CanonicalV1AliasConvention adds /v1:\n  "
            + string.Join("\n  ", violations));
    }
}
