using System.ComponentModel.DataAnnotations;

namespace RealEstateEval.Valuation.Application.Contracts;

public class EvaluatorRecallDto
{
    public Guid Id { get; init; }
    public required string TaskId { get; init; }
    public required string PoNumber { get; init; }
    public required string PropertyId { get; init; }
    public required string Status { get; init; }
    public required string Reason { get; init; }
    public required string SpecialistNote { get; init; }
    public DateTime RequestedAtUtc { get; init; }
    public DateTime? ResolvedAtUtc { get; init; }
}

public class CreateEvaluatorRecallRequest
{
    [Required, MaxLength(64)]
    public string TaskId { get; init; } = "";
    [Required, MaxLength(64)]
    public string PoNumber { get; init; } = "";
    [Required, MaxLength(128)]
    public string PropertyId { get; init; } = "";
    [MaxLength(4000)]
    public string? Reason { get; init; }
}

public class RejectEvaluatorRecallRequest
{
    [MaxLength(4000)]
    public string? SpecialistNote { get; init; }
}
