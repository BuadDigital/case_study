using System.Text.RegularExpressions;
using RealEstateEval.Architecture.Tests.Support;

namespace RealEstateEval.Architecture.Tests;

/// <summary>
/// C11: hand-written controller failures use <c>ApiProblemExtensions</c>
/// (RFC 7807 + legacy <c>error</c>/<c>message</c>/<c>errors</c>), not ad-hoc anonymous bodies.
/// </summary>
public class ApiErrorShapeTests
{
    private static readonly Regex AdHocErrorBody = new(
        @"\b(?:BadRequest|Conflict|Unauthorized|NotFound|StatusCode)\s*\(\s*(?:new\s*\{|ex\.Message|"")",
        RegexOptions.Compiled);

    [Fact]
    public void Controllers_do_not_return_ad_hoc_error_bodies()
    {
        var servicesRoot = RepoPaths.Combine("backend", "services");
        var violations = new List<string>();

        foreach (var file in RepoPaths.CSharpFiles(servicesRoot))
        {
            if (!file.Replace('\\', '/').Contains("/Controllers/", StringComparison.OrdinalIgnoreCase))
                continue;

            var text = File.ReadAllText(file);
            if (text.Contains("FieldErrorsResponseDto", StringComparison.Ordinal))
                violations.Add($"{RepoPaths.Relative(file)}: FieldErrorsResponseDto");

            foreach (Match match in AdHocErrorBody.Matches(text))
                violations.Add($"{RepoPaths.Relative(file)}: {match.Value.Trim()}");
        }

        Assert.True(
            violations.Count == 0,
            "Use ApiProblemExtensions (BadRequestProblem / FieldErrorsProblem / …) instead of ad-hoc bodies:\n  "
            + string.Join("\n  ", violations));
    }
}
