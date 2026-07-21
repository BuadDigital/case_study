namespace RealEstateEval.Domain;

/// <summary>Named party-fee pricing schedule. Exactly one row should be <see cref="IsActive"/>.</summary>
public class PartyFeePricingTable
{
    public Guid Id { get; set; }

    public string Name { get; set; } = "";

    /// <see cref="RealEstateEval.Application.PartyFeePricingCategories"/>
    public string Category { get; set; } = "";

    public bool IsActive { get; set; }

    /// <summary>Government reviewer — متعاون فرد only.</summary>
    public decimal GovernmentReviewFeeSar { get; set; }

    /// <summary>أتعاب استلام مفاتيح من المحكمة (تحصيل من إنفاذ).</summary>
    public decimal KeyReceiptFeeSar { get; set; }

    public decimal FieldInspectorIndividualFeeSar { get; set; }
    public decimal FieldInspectorOrganizationFeeSar { get; set; }

    public DateTime UpdatedAtUtc { get; set; }

    public List<PartyFeePricingTier> AreaTiers { get; set; } = [];
}
