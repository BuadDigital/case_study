using System.Net;
using System.Text.RegularExpressions;

namespace RealEstateEval.Valuation.Application.Rules;

/// <summary>
/// The approved report is frozen with the deposit-code line empty («رمز إيداع التقرير:» in every page header,
/// written by the browser's report builder). The final copy is that same HTML with the recorded code in each
/// header — nothing else changes.
/// </summary>
public static partial class ReportDepositCodeRewriter
{
    public const string Label = "رمز إيداع التقرير:";

    /// <summary>The page headers (<c>.pg-meta</c>) the code was written into.</summary>
    public readonly record struct Result(string Html, int Replaced);

    public static Result Apply(string html, string depositCode)
    {
        var code = WebUtility.HtmlEncode(depositCode.Trim());
        var replaced = 0;
        var output = PageMeta().Replace(html, header =>
        {
            var inner = CodeLine().Replace(header.Groups["body"].Value, _ =>
            {
                replaced++;
                return $"{Label} {code}";
            });
            return header.Groups["open"].Value + inner + header.Groups["close"].Value;
        });
        return new Result(output, replaced);
    }

    [GeneratedRegex(@"(?<open><div[^>]*class=""[^""]*\bpg-meta\b[^""]*""[^>]*>)(?<body>.*?)(?<close></div>)", RegexOptions.Singleline)]
    private static partial Regex PageMeta();

    // The label and whatever value follows it, up to the next tag (or the end of the header).
    [GeneratedRegex("رمز إيداع التقرير:[^<]*")]
    private static partial Regex CodeLine();
}
