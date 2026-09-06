using System.Text;
using System.Text.Json;

namespace RealEstateEval.Operations.Application.Rules;

/// <summary>
/// Turns the free-text <c>q</c> of <c>GET /api/operations-tasks</c> into the two literals the deed
/// search needs. Pure: no EF, no I/O — the query service feeds these to
/// <c>EF.Functions.JsonContains</c> and <c>EF.Functions.Like</c>. See
/// docs/architecture/pagination-contract.md §3.
/// </summary>
public static class OperationsTaskDeedSearch
{
 /// <summary>
 /// Escape character for the <c>LIKE</c> pattern, passed explicitly to <c>EF.Functions.Like</c>:
 /// the two-argument overload emits <c>ESCAPE ''</c>, which is no escape character at all.
 /// </summary>
    public const string LikeEscape = "\\";

    private const char LikeEscapeChar = '\\';

 /// <summary>
 /// The right-hand side of <c>DeedsJson @&gt; …</c>: a one-element JSON array holding the search
 /// text. Matches when the task carries that deed number exactly.
 /// </summary>
    public static string ContainmentJson(string search) =>
        JsonSerializer.Serialize(new[] { search });

 /// <summary>
 /// The <c>LIKE</c> pattern for the generated text projection of the column. PostgreSQL's default
 /// escape character is a backslash, so the three pattern metacharacters are escaped with one.
 /// </summary>
    public static string SubstringPattern(string search)
    {
        var pattern = new StringBuilder(search.Length + 2);
        pattern.Append('%');
        foreach (var c in search)
        {
            if (c == LikeEscapeChar || c == '%' || c == '_') pattern.Append(LikeEscapeChar);
            pattern.Append(c);
        }

        pattern.Append('%');
        return pattern.ToString();
    }
}
