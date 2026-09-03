using System.Text.Json;
using RealEstateEval.Domain;
using RealEstateEval.Application.Contracts;

namespace RealEstateEval.CaseStudy.Application.Mapping;

/// <summary>
/// The workflow task's distribution draft is stored as JSON on the row. Serialisation lives here
/// so Application use cases can seed and read it without reaching into an Infrastructure mapper.
/// </summary>
public static class WorkflowTaskDistributionJson
{
    private static readonly JsonSerializerOptions JsonOpts = JsonDefaults.CamelCase;

    public static TaskDistributionDraftDto Default() => new();

    public static TaskDistributionDraftDto? Deserialize(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try
        {
            return JsonSerializer.Deserialize<TaskDistributionDraftDto>(json, JsonOpts);
        }
        catch
        {
            return null;
        }
    }

    public static string Serialize(TaskDistributionDraftDto? dto) =>
        JsonSerializer.Serialize(dto ?? Default(), JsonOpts);
}
