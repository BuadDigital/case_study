namespace RealEstateEval.Application.Contracts;

public sealed class PartyFeePricingTableSummaryDto
{
    public Guid Id { get; set; }
    public string Category { get; set; } = "";
    public string Name { get; set; } = "";
    public bool IsActive { get; set; }
    public DateTime? UpdatedAtUtc { get; set; }
}

public sealed class PartyFeePricingTierDto
{
    public Guid? Id { get; set; }
    public int SortOrder { get; set; }

    /// <summary>Inclusive max م². Null = open-ended (must be last tier).</summary>
    public decimal? MaxAreaM2 { get; set; }

    public decimal FeeSar { get; set; }
}

/// <summary>Editable named party-fee pricing schedule for one category.</summary>
public sealed class PartyFeePricingDto
{
    public Guid Id { get; set; }
    public string Category { get; set; } = "";
    public string Name { get; set; } = "";
    public bool IsActive { get; set; }

    public List<PartyFeePricingTierDto> AreaTiers { get; set; } = [];

    public decimal GovernmentReviewFeeSar { get; set; }
    public decimal KeyReceiptFeeSar { get; set; }
    public decimal FieldInspectorIndividualFeeSar { get; set; }
    public decimal FieldInspectorOrganizationFeeSar { get; set; }
    public DateTime? UpdatedAtUtc { get; set; }
}

public sealed class CreatePartyFeePricingTableRequest
{
    public string Category { get; set; } = "";
    public string Name { get; set; } = "";

    /// <summary>Optional source table to clone fees/tiers from.</summary>
    public Guid? CopyFromTableId { get; set; }
}
