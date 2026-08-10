namespace RealEstateEval.Domain;

/// <summary>Named party-fee pricing schedule. Exactly one row per category should be <see cref="IsActive"/> (category default).</summary>
public class PartyFeePricingTable
{
    public Guid Id { get; set; }

    public string Name { get; set; } = "";

    /// <see cref="RealEstateEval.Application.PartyFeePricingCategories"/>
    public string Category { get; set; } = "";

    /// <summary>tiered | party-rates | flat — see <c>PartyFeePricingKinds</c>.</summary>
    public string PricingKind { get; set; } = "party-rates";

    /// <summary>system-admin | supervisor — who may edit the rates.</summary>
    public string ManagedBy { get; set; } = "system-admin";

    /// <summary>Category default used when the assignee has no explicit assignment.</summary>
    public bool IsActive { get; set; }

    /// <summary>أتعاب الزيارة — earned on ops <c>court_visit</c> complete (متعاون فرد).</summary>
    public decimal CourtVisitFeeSar { get; set; }

    // Key-receipt fees are deliberately absent. They are company revenue billed to إنفاذ, not a rate
    // owed to a party, and finance enters the amount by hand during enforcement billing. Registering
    // the envelope only marks the entitlement — see KeyEnvelope.RevenueEntitlementAtUtc.

    public decimal FieldInspectorIndividualFeeSar { get; set; }
    public decimal FieldInspectorOrganizationFeeSar { get; set; }

    /// <summary>Single incentive amount when <see cref="PricingKind"/> is flat.</summary>
    public decimal FlatAmountSar { get; set; }

    public DateTime UpdatedAtUtc { get; set; }

    public List<PartyFeePricingTier> AreaTiers { get; set; } = [];

    public List<PartyFeePricingAssignment> Assignments { get; set; } = [];
}
