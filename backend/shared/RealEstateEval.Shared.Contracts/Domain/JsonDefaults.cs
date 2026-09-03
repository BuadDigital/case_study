using System.Text.Json;

namespace RealEstateEval.Domain;

/// <summary>
/// Shared System.Text.Json options — were duplicated as static fields in 17 files in four formats.
/// Fields are read-only and are not modified after the first use (JsonSerializerOptions freezes on the first Serialize).
/// </summary>
public static class JsonDefaults
{
 /// <summary>camelCase Case-insensitive write + read — format of interface payloads.</summary>
    public static readonly JsonSerializerOptions CamelCaseInsensitive = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
    };

 /// <summary>camelCase In writing only.</summary>
    public static readonly JsonSerializerOptions CamelCase = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

 /// <summary>Case insensitive reading with property names as is.</summary>
    public static readonly JsonSerializerOptions CaseInsensitive = new()
    {
        PropertyNameCaseInsensitive = true,
    };

 /// <summary>No smuggling of Arabic into the stored text (screenshots are read manually).</summary>
    public static readonly JsonSerializerOptions RelaxedEscaping = new()
    {
        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

 /// <summary>Full web defaults (camelCase + insensitive + numbers from text).</summary>
    public static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);
}
