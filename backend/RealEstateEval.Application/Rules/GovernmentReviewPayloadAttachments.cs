using System.Text.Json;

namespace RealEstateEval.Application.Rules;

/// <summary>
/// Extracts keys-proof attachment references from a government-review payload.
/// Preferred shape: <c>{ id, fileName, mimeType, attachmentId }</c> (no dataUrl).
/// Legacy base64 <c>dataUrl</c> entries are tolerated until clients migrate.
/// </summary>
public static class GovernmentReviewPayloadAttachments
{
    public const string Scope = "government-keys-proof";

    public readonly record struct Ref(Guid AttachmentId, string ProofId);

    public static IReadOnlyList<Ref> Collect(JsonElement root)
    {
        var list = new List<Ref>();
        if (!root.TryGetProperty("keysProofFiles", out var files)
            || files.ValueKind != JsonValueKind.Array)
        {
            return list;
        }

        foreach (var file in files.EnumerateArray())
        {
            if (file.ValueKind != JsonValueKind.Object) continue;
            var attachmentIdRaw = ReadString(file, "attachmentId");
            if (!Guid.TryParse(attachmentIdRaw, out var attachmentId) || attachmentId == Guid.Empty)
                continue;

            var proofId = ReadString(file, "id");
            if (string.IsNullOrWhiteSpace(proofId))
                proofId = attachmentId.ToString("N");

            list.Add(new Ref(attachmentId, proofId));
        }

        return list;
    }

    /// <summary>
    /// True when keys are received and every proof file still embeds a dataUrl
    /// without an attachmentId (legacy, non-durable).
    /// </summary>
    public static bool HasLegacyDataUrlWithoutAttachment(JsonElement root)
    {
        if (!root.TryGetProperty("keysProofFiles", out var files)
            || files.ValueKind != JsonValueKind.Array
            || files.GetArrayLength() == 0)
        {
            return false;
        }

        foreach (var file in files.EnumerateArray())
        {
            if (file.ValueKind != JsonValueKind.Object) continue;
            var hasAttachment = Guid.TryParse(ReadString(file, "attachmentId"), out var id) && id != Guid.Empty;
            var hasDataUrl = !string.IsNullOrWhiteSpace(ReadString(file, "dataUrl"));
            if (hasDataUrl && !hasAttachment)
                return true;
        }

        return false;
    }

    public static string ScopeKey(Guid workflowTaskId, string proofId) =>
        $"{workflowTaskId}:{proofId}";

    static string ReadString(JsonElement element, string name)
    {
        if (!element.TryGetProperty(name, out var prop)) return "";
        return prop.ValueKind == JsonValueKind.String
            ? prop.GetString()?.Trim() ?? ""
            : "";
    }
}
