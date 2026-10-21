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
