namespace RealEstateEval.Domain;

/// <summary>Named party-fee pricing schedule. Exactly one row per category should be <see cref="IsActive"/> (category default).</summary>
public class PartyFeePricingTable
{
    public Guid Id { get; set; }

    public string Name { get; set; } = "";

    /// <see cref="RealEstateEval.Application.PartyFeePricingCategories"/>
    public string Category { get; set; } = "";

    /// <summary>Category default used when the assignee has no explicit assignment.</summary>
    public bool IsActive { get; set; }

    /// <summary>أتعاب الزيارة — earned on ops <c>court_visit</c> complete (متعاون فرد).</summary>
    public decimal GovernmentReviewFeeSar { get; set; }

    /// <summary>أتعاب استلام المفاتيح — earned on court envelope register + photo (تحصيل من إنفاذ).</summary>
    public decimal KeyReceiptFeeSar { get; set; }

    public decimal FieldInspectorIndividualFeeSar { get; set; }
    public decimal FieldInspectorOrganizationFeeSar { get; set; }

    public DateTime UpdatedAtUtc { get; set; }

    public List<PartyFeePricingTier> AreaTiers { get; set; } = [];

    public List<PartyFeePricingAssignment> Assignments { get; set; } = [];
}
