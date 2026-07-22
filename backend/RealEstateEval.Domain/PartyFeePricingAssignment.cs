namespace RealEstateEval.Domain;

/// <summary>
/// Links a pricing table to a distribution assignee (office / reviewer / inspector).
/// One assignee may have at most one table per category.
/// </summary>
public class PartyFeePricingAssignment
{
    public Guid Id { get; set; }

    public Guid TableId { get; set; }

    /// <see cref="RealEstateEval.Application.PartyFeePricingCategories"/>
    public string Category { get; set; } = "";

    /// <summary>Workflow / distribution assignee id (e.g. eo-…).</summary>
    public string AssigneeId { get; set; } = "";

    public DateTime UpdatedAtUtc { get; set; }

    public PartyFeePricingTable? Table { get; set; }
}
