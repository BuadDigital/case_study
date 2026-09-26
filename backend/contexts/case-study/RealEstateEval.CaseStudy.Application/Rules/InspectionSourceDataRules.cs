using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Application.Rules;

/// <summary>
/// Offline conflict rule (security_offline_spec §4.4): every field has one owning source.
/// Commissioning data, deed, owner, court/circuit and request number belong to the
/// specialist / bourse, so the server always wins on them — the inspector's package never
/// carries them. The special case is detection: when that source data changed after the
/// inspector downloaded it, the specialist is told to review the answers.
/// <para>
/// The device holds <see cref="Fingerprint"/> as it was when the task was loaded and sends it
/// back under <see cref="SeenPayloadKey"/> with every save — an offline save replayed later
/// still carries the old value.
/// </para>
/// </summary>
public static class InspectionSourceDataRules
{
    /// <summary>Payload key the inspector's device sends; stripped before the payload is stored.</summary>
    public const string SeenPayloadKey = "sourceFingerprintSeen";

    private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNameCaseInsensitive = true };

    /// <summary>Stable hash of the specialist-owned source fields of a property.</summary>
    public static string Fingerprint(WorkOrderProperty property)
    {
        var parts = new[]
        {
            property.AssignmentMandateNumber,
            property.AssignmentMandateDate,
            property.DeedKind.ToString(),
            property.DeedNumber,
            property.DeedDate,
            property.RealEstateRegNumber,
            property.RealEstateRegDate,
            property.HasRequestNumber ? property.RequestNumber : "",
            property.OwnerName,
            NormalizeOwners(property.DeedOwnersJson),
            property.Court,
            property.Circuit,
        };
        var joined = string.Join("\u001f", parts.Select(p => (p ?? "").Trim()));
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(joined));
        return Convert.ToHexString(hash, 0, 16).ToLowerInvariant();
    }

    /// <summary>Owners JSON compared by content, not by formatting or key order.</summary>
    private static string NormalizeOwners(string? ownersJson)
    {
        if (string.IsNullOrWhiteSpace(ownersJson)) return "";
        try
        {
            var owners = JsonSerializer.Deserialize<List<OwnerShare>>(ownersJson, JsonOpts) ?? [];
            return string.Join(
                ";",
                owners.Select(o => $"{o.Name?.Trim()}={o.SharePct?.GetRawText().Trim('"')}"));
        }
        catch (JsonException)
        {
            return ownersJson.Trim();
        }
    }

    private sealed class OwnerShare
    {
        public string? Name { get; set; }
        /// <summary>Number or string in stored data — compared by its raw text.</summary>
        public JsonElement? SharePct { get; set; }
    }

    /// <summary>
    /// True when the device saw different source data than the server holds now.
    /// A save without a fingerprint (older clients, staff corrections) never alerts.
    /// </summary>
    public static bool ChangedSinceDownload(string? seenFingerprint, WorkOrderProperty property) =>
        !string.IsNullOrWhiteSpace(seenFingerprint)
        && !string.Equals(seenFingerprint.Trim(), Fingerprint(property), StringComparison.Ordinal);
}
