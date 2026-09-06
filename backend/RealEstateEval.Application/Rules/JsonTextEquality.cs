using System.Text.Json.Nodes;

namespace RealEstateEval.Application.Rules;

/// <summary>
/// Structural comparison of two JSON documents held as text. Needed wherever a column is
/// <c>jsonb</c>: PostgreSQL stores the parsed value, so the text read back has normalised key
/// order and whitespace and a byte-for-byte comparison against freshly serialised text would
/// report a change on every save.
/// </summary>
public static class JsonTextEquality
{
    public static bool SemanticallyEqual(string? left, string? right)
    {
        if (string.Equals(left, right, StringComparison.Ordinal)) return true;
        if (string.IsNullOrWhiteSpace(left) || string.IsNullOrWhiteSpace(right)) return false;

        try
        {
            return JsonNode.DeepEquals(JsonNode.Parse(left), JsonNode.Parse(right));
        }
        catch (System.Text.Json.JsonException)
        {
            return false;
        }
    }
}
