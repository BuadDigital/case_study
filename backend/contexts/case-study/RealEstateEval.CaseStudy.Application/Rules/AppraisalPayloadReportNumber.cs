using System.Text;
using System.Text.Json;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Domain;

namespace RealEstateEval.CaseStudy.Application.Rules;

/// <summary>
/// The appraisal package carries the valuation report number as <c>reportNo</c> in its payload
/// (the Enfaz upload sheet and the report print read it there). The number is PRV-… derived from
/// the transaction's official reference, stamped the moment that reference is confirmed.
/// </summary>
public static class AppraisalPayloadReportNumber
{
    /// <summary>Writes <paramref name="reportNo"/> into the payload; replaces an older value (a reserved TQ number, an empty one).</summary>
    /// <remarks>
    /// How it works: parses the payload (empty → {}), copies every property unchanged except
    /// reportNo, which gets the new number, appends reportNo when it was missing, and returns the JSON.
    /// Edge cases: a payload that is not a JSON object, or not JSON at all, is replaced by
    /// <see cref="Seed"/> rather than failing. Unlike the old dispatch merge, which kept any existing
    /// reportNo, this always overwrites — so the old reserved TQ-… numbers give way to PRV (2026-10-19).
    /// </remarks>
    public static string Stamp(string? payloadJson, string reportNo, WorkflowTask appraisalTask)
    {
        try
        {
            using var doc = JsonDocument.Parse(
                string.IsNullOrWhiteSpace(payloadJson) ? "{}" : payloadJson);
            if (doc.RootElement.ValueKind != JsonValueKind.Object)
                return Seed(appraisalTask, reportNo);

            using var stream = new MemoryStream();
            using (var writer = new Utf8JsonWriter(stream))
            {
                writer.WriteStartObject();
                var wrote = false;
                foreach (var prop in doc.RootElement.EnumerateObject())
                {
                    if (prop.NameEquals("reportNo"))
                    {
                        wrote = true;
                        writer.WriteString("reportNo", reportNo);
                    }
                    else
                    {
                        prop.WriteTo(writer);
                    }
                }

                if (!wrote) writer.WriteString("reportNo", reportNo);
                writer.WriteEndObject();
            }

            return Encoding.UTF8.GetString(stream.ToArray());
        }
        catch (JsonException)
        {
            return Seed(appraisalTask, reportNo);
        }
    }

    /// <summary>A fresh draft payload carrying only the task identity and the report number (no payload yet, or an unreadable one).</summary>
    /// <remarks>
    /// How it works: serialises taskId, propertyId, poNumber, status = draft and reportNo.
    /// Edge cases: a task without a property or PO number writes "" for them.
    /// </remarks>
    public static string Seed(WorkflowTask appraisalTask, string reportNo)
    {
        var payload = new Dictionary<string, object?>
        {
            ["taskId"] = appraisalTask.Id.ToString("D"),
            ["propertyId"] = appraisalTask.PropertyId?.ToString("D") ?? "",
            ["poNumber"] = appraisalTask.PoNumber ?? "",
            ["status"] = PartyTaskSubmissionStatus.Draft,
            ["reportNo"] = reportNo,
        };
        return JsonSerializer.Serialize(payload);
    }
}
