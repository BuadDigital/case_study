using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using System.Text.Json;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Infrastructure.Services;

public static class WorkflowTaskMapper
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    public static WorkflowTaskDto ToDto(WorkflowTask entity)
    {
        return new WorkflowTaskDto
        {
            Id = entity.Id.ToString(),
            Kind = entity.Kind.ToDbValue(),
            PoNumber = entity.PoNumber,
            PropertyId = entity.PropertyId?.ToString(),
            PropertyOrdinal = entity.PropertyOrdinal,
            Title = entity.Title,
            Phase = entity.Phase.ToDbValue(),
            AssigneeRole = entity.AssigneeRole,
            AssigneeName = entity.AssigneeName,
            AssigneeId = entity.AssigneeId,
            ParentTaskId = entity.ParentTaskId?.ToString(),
            Status = entity.Status.ToDbValue(),
            Distribution = DeserializeDistribution(entity.DistributionJson),
            ObstructionReason = entity.ObstructionReason,
            ObstructionPriorPhase = entity.ObstructionPriorPhase?.ToDbValue(),
            AssignmentType = entity.AssignmentType,
            CreatedAt = entity.CreatedAtUtc.ToString("O"),
            UpdatedAt = entity.UpdatedAtUtc.ToString("O"),
        };
    }

    public static TaskDistributionDraftDto DefaultDistribution() => new();

    public static TaskDistributionDraftDto? DeserializeDistribution(string? json)
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

    public static string SerializeDistribution(TaskDistributionDraftDto? dto)
    {
        return JsonSerializer.Serialize(dto ?? DefaultDistribution(), JsonOpts);
    }
}
