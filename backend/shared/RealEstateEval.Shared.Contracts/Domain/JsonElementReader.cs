using System.Globalization;
using System.Text.Json;

namespace RealEstateEval.Domain;

/// <summary>
/// JsonElement secure reads of submission payloads — replicated in four validators
/// Through the Application and Case Study projects.
/// </summary>
public static class JsonElementReader
{
    public static string ReadString(JsonElement element, string name)
    {
        if (!element.TryGetProperty(name, out var prop) || prop.ValueKind != JsonValueKind.String)
            return "";
        return prop.GetString()?.Trim() ?? "";
    }

    public static bool HasNonEmptyString(JsonElement element, string name) =>
        !string.IsNullOrWhiteSpace(ReadString(element, name));

    public static bool GetBool(JsonElement element, string name)
    {
        if (!element.TryGetProperty(name, out var prop))
            return false;
        return prop.ValueKind == JsonValueKind.True;
    }

    public static int ReadInt(JsonElement element, string name)
    {
        if (!element.TryGetProperty(name, out var prop))
            return 0;
        return prop.ValueKind switch
        {
            JsonValueKind.Number when prop.TryGetInt32(out var n) => n,
            JsonValueKind.String when int.TryParse(
                prop.GetString(),
                NumberStyles.Integer,
                CultureInfo.InvariantCulture,
                out var parsed) => parsed,
            _ => 0,
        };
    }

    public static bool TryReadGuid(JsonElement element, string name, out Guid id)
    {
        id = Guid.Empty;
        if (!element.TryGetProperty(name, out var prop) || prop.ValueKind != JsonValueKind.String)
            return false;
        return Guid.TryParse(prop.GetString(), out id);
    }
}
