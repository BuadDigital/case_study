using System.Text.Json;
using System.Text.Json.Serialization;

namespace RealEstateEval.Infrastructure.Permissions;

/// <summary>
/// Stores per-page visibility overrides on linked custom screens (DefinitionJson).</summary>
public static class LinkedPageAccessMetadata
{
    private sealed class Payload
    {
        [JsonPropertyName("excludedUserIds")]
        public List<string>? ExcludedUserIds { get; set; }
    }

    public static IReadOnlyList<string> ReadExcludedUserIds(string? definitionJson)
    {
        if (string.IsNullOrWhiteSpace(definitionJson) || definitionJson == "{}")
            return [];

        try
        {
            var payload = JsonSerializer.Deserialize<Payload>(definitionJson);
            if (payload?.ExcludedUserIds is null || payload.ExcludedUserIds.Count == 0)
                return [];

            return payload.ExcludedUserIds
                .Where(id => !string.IsNullOrWhiteSpace(id))
                .Select(id => id.Trim())
                .Distinct(StringComparer.Ordinal)
                .ToList();
        }
        catch
        {
            return [];
        }
    }

    public static string WriteExcludedUserIds(IReadOnlyList<string> excludedUserIds)
    {
        var distinct = excludedUserIds
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Select(id => id.Trim())
            .Distinct(StringComparer.Ordinal)
            .ToList();

        if (distinct.Count == 0)
            return "{}";

        return JsonSerializer.Serialize(new Payload { ExcludedUserIds = distinct });
    }

    public static bool IsUserExcluded(string? definitionJson, string userId)
    {
        if (string.IsNullOrWhiteSpace(userId))
            return false;

        return ReadExcludedUserIds(definitionJson)
            .Contains(userId.Trim(), StringComparer.Ordinal);
    }
}
