using System.Text.Json;
using RealEstateEval.Application.Rules;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.Domain;

namespace RealEstateEval.CaseStudy.Application.Rules;

/// <summary>
/// Diffs two party-submission payloads and stamps who wrote / last edited each changed field.
/// A key is a top-level payload key, or <c>parent.child</c> for one level of nesting
/// (<c>featureValues.assetSubject</c>). Pure — no ports, no I/O.
/// </summary>
/// <remarks>
/// Rules: the first non-empty value stamps «written by»; a later change by someone other than
/// the latest toucher stamps «edited by»; the same person refining their own value only refreshes
/// the time. Clearing a value is an edit; identity comes from JWT claims, never the client body.
/// </remarks>
public static class PartyFieldProvenance
{
    /// <summary>Workflow / bookkeeping keys the server or task owns — never attributed to a person.</summary>
    private static readonly HashSet<string> IgnoredKeys = new(StringComparer.Ordinal)
    {
        "status", "submittedAtUtc", "updatedAtUtc", "acceptedAtUtc", "acceptedByName",
        "returnNote", "taskId", "propertyId", "poNumber", "propertyDisplayId",
    };

    private static readonly JsonSerializerOptions JsonOpts = JsonDefaults.CamelCase;

    public static Dictionary<string, PartyFieldProvenanceEntryDto> Parse(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
            return new(StringComparer.Ordinal);

        try
        {
            return JsonSerializer.Deserialize<Dictionary<string, PartyFieldProvenanceEntryDto>>(json, JsonOpts)
                   ?? new(StringComparer.Ordinal);
        }
        catch
        {
            return new(StringComparer.Ordinal);
        }
    }

    public static string Serialize(Dictionary<string, PartyFieldProvenanceEntryDto> map) =>
        JsonSerializer.Serialize(map, JsonOpts);

    /// <summary>
    /// Returns the provenance JSON after applying <paramref name="nextPayloadJson"/> on top of
    /// <paramref name="previousPayloadJson"/>. Unchanged when there is no identifiable actor.
    /// </summary>
    public static string Stamp(
        string? existingProvenanceJson,
        string? previousPayloadJson,
        string nextPayloadJson,
        PartySubmissionActor? actor,
        DateTime nowUtc)
    {
        var existing = existingProvenanceJson ?? "{}";
        if (actor is null
            || (string.IsNullOrWhiteSpace(actor.UserId) && string.IsNullOrWhiteSpace(actor.DisplayName)))
        {
            return existing;
        }

        var previous = Flatten(previousPayloadJson);
        var next = Flatten(nextPayloadJson);
        var map = Parse(existing);
        var changed = false;
        var at = nowUtc.ToString("O");

        foreach (var (key, nextValue) in next)
        {
            var hasPrev = previous.TryGetValue(key, out var prevValue);
            var prevEmpty = !hasPrev || IsEmpty(prevValue);
            var nextEmpty = IsEmpty(nextValue);
            if (prevEmpty && nextEmpty) continue;
            if (!prevEmpty && !nextEmpty
                && JsonTextEquality.SemanticallyEqual(prevValue.GetRawText(), nextValue.GetRawText()))
            {
                continue;
            }

            map.TryGetValue(key, out var entry);
            map[key] = ApplyChange(entry, prevEmpty, actor, at);
            changed = true;
        }

        // A key removed from the payload entirely is an edit too (value cleared).
        foreach (var (key, prevValue) in previous)
        {
            if (next.ContainsKey(key) || IsEmpty(prevValue) || !map.TryGetValue(key, out var entry)) continue;
            entry.EditedByUserId = Clean(actor.UserId);
            entry.EditedByName = Clean(actor.DisplayName);
            entry.EditedByRole = Clean(actor.PrototypeRole);
            entry.EditedAtUtc = at;
            changed = true;
        }

        return changed ? Serialize(map) : existing;
    }

    /// <summary>
    /// One value changed. A first write (previously empty) stamps the writer; a change by
    /// someone other than the latest toucher stamps the editor; the same person only refreshes the time.
    /// A value that predates tracking (no entry) records the editor and leaves the writer unknown.
    /// </summary>
    public static PartyFieldProvenanceEntryDto ApplyChange(
        PartyFieldProvenanceEntryDto? entry,
        bool previouslyEmpty,
        PartySubmissionActor actor,
        string at)
    {
        if (previouslyEmpty) return NewEntry(actor, at);
        if (entry is null)
        {
            return new PartyFieldProvenanceEntryDto
            {
                EditedByUserId = Clean(actor.UserId),
                EditedByName = Clean(actor.DisplayName),
                EditedByRole = Clean(actor.PrototypeRole),
                EditedAtUtc = at,
            };
        }

        var hasEditor = !string.IsNullOrWhiteSpace(entry.EditedByUserId ?? entry.EditedByName);
        var touchedBy = hasEditor
            ? (entry.EditedByUserId, entry.EditedByName)
            : (entry.WrittenByUserId, entry.WrittenByName);
        if (SamePerson(touchedBy.Item1, touchedBy.Item2, actor))
        {
            if (hasEditor) entry.EditedAtUtc = at;
            else entry.WrittenAtUtc = at;
        }
        else
        {
            entry.EditedByUserId = Clean(actor.UserId);
            entry.EditedByName = Clean(actor.DisplayName);
            entry.EditedByRole = Clean(actor.PrototypeRole);
            entry.EditedAtUtc = at;
        }

        return entry;
    }

    public static PartyFieldProvenanceEntryDto? ParseSingle(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try
        {
            var entry = JsonSerializer.Deserialize<PartyFieldProvenanceEntryDto>(json, JsonOpts);
            return entry is null || (string.IsNullOrEmpty(entry.WrittenAtUtc) && entry.EditedAtUtc is null
                && string.IsNullOrWhiteSpace(entry.WrittenByName) && string.IsNullOrWhiteSpace(entry.EditedByName))
                ? null
                : entry;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    public static string SerializeSingle(PartyFieldProvenanceEntryDto entry) =>
        JsonSerializer.Serialize(entry, JsonOpts);

    public static PartyFieldProvenanceEntryDto NewEntryFor(PartySubmissionActor actor, DateTime nowUtc) =>
        NewEntry(actor, nowUtc.ToString("O"));

    private static PartyFieldProvenanceEntryDto NewEntry(PartySubmissionActor actor, string at) => new()
    {
        WrittenByUserId = Clean(actor.UserId),
        WrittenByName = Clean(actor.DisplayName),
        WrittenByRole = Clean(actor.PrototypeRole),
        WrittenAtUtc = at,
    };

    private static bool SamePerson(string? userId, string? name, PartySubmissionActor actor)
    {
        if (!string.IsNullOrWhiteSpace(userId) && !string.IsNullOrWhiteSpace(actor.UserId))
            return string.Equals(userId, actor.UserId, StringComparison.Ordinal);
        return !string.IsNullOrWhiteSpace(name)
               && string.Equals(name, actor.DisplayName.Trim(), StringComparison.Ordinal);
    }

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    /// <summary>null / "" / false / empty array / empty object all count as «no value».</summary>
    private static bool IsEmpty(JsonElement value) => value.ValueKind switch
    {
        JsonValueKind.Undefined or JsonValueKind.Null or JsonValueKind.False => true,
        JsonValueKind.String => string.IsNullOrWhiteSpace(value.GetString()),
        JsonValueKind.Array => value.GetArrayLength() == 0,
        JsonValueKind.Object => !value.EnumerateObject().Any(),
        _ => false,
    };

    private static Dictionary<string, JsonElement> Flatten(string? payloadJson)
    {
        var result = new Dictionary<string, JsonElement>(StringComparer.Ordinal);
        if (string.IsNullOrWhiteSpace(payloadJson)) return result;

        try
        {
            using var doc = JsonDocument.Parse(payloadJson);
            if (doc.RootElement.ValueKind != JsonValueKind.Object) return result;

            foreach (var prop in doc.RootElement.EnumerateObject())
            {
                if (IgnoredKeys.Contains(prop.Name)) continue;

                if (prop.Value.ValueKind == JsonValueKind.Object)
                {
                    foreach (var child in prop.Value.EnumerateObject())
                        result[$"{prop.Name}.{child.Name}"] = child.Value.Clone();
                }
                else
                {
                    result[prop.Name] = prop.Value.Clone();
                }
            }
        }
        catch (JsonException)
        {
            // Unparsable payloads are rejected elsewhere; nothing to attribute.
        }

        return result;
    }
}
