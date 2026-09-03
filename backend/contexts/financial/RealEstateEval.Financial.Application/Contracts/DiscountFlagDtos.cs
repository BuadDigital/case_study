namespace RealEstateEval.Financial.Application.Contracts;

public sealed class DiscountFlagDto
{
    public string Id { get; set; } = "";
    public string TransactionKey { get; set; } = "";
    public string? WorkflowTaskId { get; set; }
    public string TargetAssigneeId { get; set; } = "";
    public string FlaggedByUserId { get; set; } = "";
    public string Reason { get; set; } = "";
    public decimal ProposedDiscountSar { get; set; }
    public string Status { get; set; } = "";
    public string? ApprovedByUserId { get; set; }
    public DateTime? ResolvedAtUtc { get; set; }
    public string? ResolutionNote { get; set; }
    public DateTime CreatedAtUtc { get; set; }
}

public sealed class CreateDiscountFlagRequest
{
    public required string TransactionKey { get; init; }
    public string? WorkflowTaskId { get; init; }
    public required string TargetAssigneeId { get; init; }
    public required string Reason { get; init; }
    public decimal ProposedDiscountSar { get; init; }
}

public sealed class ResolveDiscountFlagRequest
{
 /// <summary>Optional override; defaults to the proposed amount on approve.</summary>
    public decimal? DiscountSar { get; init; }
    public string? DiscountReason { get; init; }
    public string? Note { get; init; }
}
