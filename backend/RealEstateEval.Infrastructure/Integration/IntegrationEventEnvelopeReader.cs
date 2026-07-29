using System.Text.Json;

namespace RealEstateEval.Infrastructure.Integration;

/// <summary>
/// Reads the routing metadata off an integration event envelope without needing to know the
/// payload type, so consumers can deduplicate before dispatching to a handler.
/// </summary>
public static class IntegrationEventEnvelopeReader
{
    /// <summary>Extracts the envelope id and type.</summary>
    /// <returns>False when the message is not a readable envelope.</returns>
    public static bool TryReadMetadata(string json, out Guid eventId, out string eventType)
    {
        eventId = Guid.Empty;
        eventType = "";

        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            if (root.ValueKind != JsonValueKind.Object)
                return false;

            // Envelopes are written with the default serializer (PascalCase) but tolerated in
            // camelCase, matching how the handlers read them.
            if (!TryGetProperty(root, "eventId", "EventId", out var idElement)
                || !idElement.TryGetGuid(out eventId)
                || eventId == Guid.Empty)
                return false;

            if (!TryGetProperty(root, "eventType", "EventType", out var typeElement))
                return false;

            eventType = typeElement.GetString() ?? "";
            return eventType.Length > 0;
        }
        catch (JsonException)
        {
            return false;
        }
    }

    private static bool TryGetProperty(
        JsonElement root,
        string camelCase,
        string pascalCase,
        out JsonElement value) =>
        root.TryGetProperty(camelCase, out value) || root.TryGetProperty(pascalCase, out value);
}
