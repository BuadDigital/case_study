using System.Text.Json;
using System.Text.Json.Nodes;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Domain;

namespace RealEstateEval.CaseStudy.Application.Rules;

/// <summary>
/// Promotes the specialist-report extras wire bag onto first-class
/// <see cref="WorkOrderProperty"/> columns, and projects those columns back to the wire JSON
/// the frontend still hydrates from.
/// </summary>
public static class SpecialistReportExtrasRules
{
    public const int WireJsonMaxLength = WorkOrderPropertyWriteRules.SpecialistReportExtrasMaxLength;
    public const int SearchScopeNotesMaxLength = 4_000;
    public const int InfathDepositCodeMaxLength = 128;
    public const int InfathDepositCertificateNameMaxLength = 512;

    private static readonly JsonSerializerOptions JsonOpts = JsonDefaults.CamelCaseInsensitive;

    /// <summary>
    /// Validate wire JSON, write known fields onto columns, and dual-write a normalized bag.
    /// Empty / literal <c>null</c> clears every specialist-extras column.
    /// </summary>
    public static Dictionary<string, string>? ApplyFromWireJson(
        WorkOrderProperty entity,
        string? specialistReportExtrasJson)
    {
        var trimmed = specialistReportExtrasJson?.Trim();
        if (string.IsNullOrEmpty(trimmed) || trimmed == "null")
        {
            Clear(entity);
            return null;
        }

        if (trimmed.Length > WireJsonMaxLength)
        {
            return new Dictionary<string, string>
            {
                ["specialistReportExtrasJson"] = "حجم البيانات أكبر من المسموح",
            };
        }

        JsonNode? root;
        try
        {
            root = JsonNode.Parse(trimmed);
        }
        catch (JsonException)
        {
            return new Dictionary<string, string>
            {
                ["specialistReportExtrasJson"] = "صيغة JSON غير صالحة",
            };
        }

        if (root is not JsonObject obj)
        {
            return new Dictionary<string, string>
            {
                ["specialistReportExtrasJson"] = "صيغة JSON غير صالحة",
            };
        }

        var finishing = NormalizeFinishing(ReadString(obj, "finishing"));
        var searchScope = NormalizeOptional(
            ReadString(obj, "searchScopeNotes"),
            SearchScopeNotesMaxLength);
        if (searchScope.Error is not null)
        {
            return new Dictionary<string, string> { ["searchScopeNotes"] = searchScope.Error };
        }

        var printKeysJson = SerializePrintKeys(obj["printKeys"]);
        if (printKeysJson.Error is not null)
        {
            return new Dictionary<string, string> { ["printKeys"] = printKeysJson.Error };
        }

        var deposit = obj["infathDeposit"] as JsonObject;
        var depositCode = NormalizeOptional(
            ReadString(deposit, "depositCode"),
            InfathDepositCodeMaxLength);
        if (depositCode.Error is not null)
        {
            return new Dictionary<string, string> { ["infathDeposit.depositCode"] = depositCode.Error };
        }

        var depositCert = NormalizeOptional(
            ReadString(deposit, "depositCertificateName"),
            InfathDepositCertificateNameMaxLength);
        if (depositCert.Error is not null)
        {
            return new Dictionary<string, string>
            {
                ["infathDeposit.depositCertificateName"] = depositCert.Error,
            };
        }

        var esgJson = SerializeEsg(obj["esg"]);
        if (esgJson.Error is not null)
        {
            return new Dictionary<string, string> { ["esg"] = esgJson.Error };
        }

        // A stale building finishing answer must not leak into land reports.
        entity.SpecialistFinishingLevel =
            InspectedPropertyTypeRules.IsLand(
                InspectedPropertyTypeRules.Effective(
                    entity.PropertyType,
                    entity.InspectedPropertyType))
                ? null
                : finishing;
        entity.SearchScopeNotes = searchScope.Value;
        entity.PrintAttachmentKeysJson = printKeysJson.Value;
        entity.InfathDepositCode = depositCode.Value;
        entity.InfathDepositCertificateName = depositCert.Value;
        entity.SpecialistEsgJson = esgJson.Value;
        entity.SpecialistReportExtrasJson = ToWireJson(entity);
        return null;
    }

    /// <summary>Project first-class columns (falling back to the legacy bag) onto wire JSON.</summary>
    public static string? ToWireJson(WorkOrderProperty entity)
    {
        if (!HasColumnData(entity))
        {
            var legacy = entity.SpecialistReportExtrasJson?.Trim();
            return string.IsNullOrEmpty(legacy) || legacy == "null" ? null : legacy;
        }

        var obj = new JsonObject();
        if (!string.IsNullOrEmpty(entity.SpecialistFinishingLevel))
            obj["finishing"] = entity.SpecialistFinishingLevel;

        if (!string.IsNullOrEmpty(entity.SearchScopeNotes))
            obj["searchScopeNotes"] = entity.SearchScopeNotes;

        if (!string.IsNullOrEmpty(entity.PrintAttachmentKeysJson))
        {
            try
            {
                obj["printKeys"] = JsonNode.Parse(entity.PrintAttachmentKeysJson);
            }
            catch (JsonException)
            {
                /* omit corrupt column */
            }
        }

        if (!string.IsNullOrEmpty(entity.InfathDepositCode)
            || !string.IsNullOrEmpty(entity.InfathDepositCertificateName))
        {
            var deposit = new JsonObject();
            if (!string.IsNullOrEmpty(entity.InfathDepositCode))
                deposit["depositCode"] = entity.InfathDepositCode;
            if (!string.IsNullOrEmpty(entity.InfathDepositCertificateName))
                deposit["depositCertificateName"] = entity.InfathDepositCertificateName;
            obj["infathDeposit"] = deposit;
        }

        if (!string.IsNullOrEmpty(entity.SpecialistEsgJson))
        {
            try
            {
                obj["esg"] = JsonNode.Parse(entity.SpecialistEsgJson);
            }
            catch (JsonException)
            {
                /* omit corrupt column */
            }
        }

        return obj.Count == 0 ? null : obj.ToJsonString(JsonOpts);
    }

    public static void Clear(WorkOrderProperty entity)
    {
        entity.SpecialistFinishingLevel = null;
        entity.SearchScopeNotes = null;
        entity.PrintAttachmentKeysJson = null;
        entity.InfathDepositCode = null;
        entity.InfathDepositCertificateName = null;
        entity.SpecialistEsgJson = null;
        entity.SpecialistReportExtrasJson = null;
    }

    private static bool HasColumnData(WorkOrderProperty entity) =>
        !string.IsNullOrEmpty(entity.SpecialistFinishingLevel)
        || !string.IsNullOrEmpty(entity.SearchScopeNotes)
        || !string.IsNullOrEmpty(entity.PrintAttachmentKeysJson)
        || !string.IsNullOrEmpty(entity.InfathDepositCode)
        || !string.IsNullOrEmpty(entity.InfathDepositCertificateName)
        || !string.IsNullOrEmpty(entity.SpecialistEsgJson);

    private static string? NormalizeFinishing(string? raw)
    {
        var t = raw?.Trim();
        if (string.IsNullOrEmpty(t)) return null;
        var lower = t.ToLowerInvariant();
        return PropertyFinishingTypes.IsKnown(lower) && !string.IsNullOrWhiteSpace(lower)
            ? lower
            : null;
    }

    private static (string? Value, string? Error) NormalizeOptional(string? raw, int maxLength)
    {
        var t = raw?.Trim();
        if (string.IsNullOrEmpty(t)) return (null, null);
        if (t.Length > maxLength) return (null, "النص أطول من المسموح");
        return (t, null);
    }

    private static (string? Value, string? Error) SerializePrintKeys(JsonNode? node)
    {
        if (node is null || node.GetValueKind() == JsonValueKind.Null)
            return (null, null);
        if (node is not JsonArray arr)
            return (null, "صيغة JSON غير صالحة");

        var keys = new List<string>();
        foreach (var item in arr)
        {
            if (item is null || item.GetValueKind() != JsonValueKind.String) continue;
            var s = item.GetValue<string>()?.Trim();
            if (!string.IsNullOrEmpty(s)) keys.Add(s);
        }

        if (keys.Count == 0) return (null, null);
        var json = JsonSerializer.Serialize(keys, JsonOpts);
        if (json.Length > WireJsonMaxLength) return (null, "حجم البيانات أكبر من المسموح");
        return (json, null);
    }

    private static (string? Value, string? Error) SerializeEsg(JsonNode? node)
    {
        if (node is null || node.GetValueKind() == JsonValueKind.Null)
            return (null, null);
        if (node is not JsonObject)
            return (null, "صيغة JSON غير صالحة");

        var json = node.ToJsonString(JsonOpts);
        if (json.Length > WireJsonMaxLength) return (null, "حجم البيانات أكبر من المسموح");
        return (json, null);
    }

    private static string? ReadString(JsonObject? obj, string key)
    {
        if (obj is null || !obj.TryGetPropertyValue(key, out var node) || node is null)
            return null;
        return node.GetValueKind() == JsonValueKind.String ? node.GetValue<string>() : node.ToJsonString();
    }
}
