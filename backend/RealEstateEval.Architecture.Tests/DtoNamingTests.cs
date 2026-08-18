using System.Text.RegularExpressions;
using RealEstateEval.Architecture.Tests.Support;

namespace RealEstateEval.Architecture.Tests;

/// <summary>
/// B10: Application contract types use a stable suffix so new DTOs do not
/// reintroduce LoginResponse / *Result drift. JSON property names are unchanged.
/// </summary>
public class DtoNamingTests
{
    private static readonly Regex PublicType = new(
        @"^\s*public\s+(?:sealed\s+)?(?:partial\s+)?(?:class|record)\s+(\w+)",
        RegexOptions.Compiled | RegexOptions.Multiline);

    private static readonly Regex AllowedSuffix = new(
        @"(Dto|Request|Query|Input|Actor)$",
        RegexOptions.Compiled);

    [Fact]
    public void Contract_types_use_the_documented_suffixes()
    {
        var contracts = RepoPaths.Combine("backend", "RealEstateEval.Application", "Contracts");
        var violations = new List<string>();

        foreach (var file in RepoPaths.CSharpFiles(contracts))
        {
            var text = File.ReadAllText(file);
            foreach (Match match in PublicType.Matches(text))
            {
                var name = match.Groups[1].Value;
                if (!AllowedSuffix.IsMatch(name))
                    violations.Add($"{RepoPaths.Relative(file)}: {name}");
            }
        }

        Assert.True(
            violations.Count == 0,
            "Contract types must end with Dto, Request, Query, Input, or Actor "
            + "(read model / command body / GET query / nested write fragment / internal actor). "
            + "Do not rename JSON properties to finish a rename:\n  "
            + string.Join("\n  ", violations));
    }
}
