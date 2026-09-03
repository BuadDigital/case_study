using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Application.Mapping;

public static class WorkflowTaskMapper
{
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

    public static TaskDistributionDraftDto DefaultDistribution() =>
        WorkflowTaskDistributionJson.Default();

    public static TaskDistributionDraftDto? DeserializeDistribution(string? json) =>
        WorkflowTaskDistributionJson.Deserialize(json);

    public static string SerializeDistribution(TaskDistributionDraftDto? dto) =>
        WorkflowTaskDistributionJson.Serialize(dto);
}
