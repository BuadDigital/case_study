namespace RealEstateEval.Application.Contracts;

public sealed class PartyFeePricingTableSummaryDto
{
    public Guid Id { get; set; }
    public string Category { get; set; } = "";
    public string Name { get; set; } = "";
    public string PricingKind { get; set; } = "";
    public string ManagedBy { get; set; } = "";
    /// <summary>Category default (fallback when assignee has no assignment).</summary>
    public bool IsActive { get; set; }
    public int AssignedCount { get; set; }
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
    public string PricingKind { get; set; } = "";
    public string ManagedBy { get; set; } = "";
    public bool IsActive { get; set; }
    public int AssignedCount { get; set; }
    public List<string> AssignedAssigneeIds { get; set; } = [];

    public List<PartyFeePricingTierDto> AreaTiers { get; set; } = [];

    public decimal CourtVisitFeeSar { get; set; }
    public decimal FieldInspectorIndividualFeeSar { get; set; }
    public decimal FieldInspectorOrganizationFeeSar { get; set; }
    public decimal FlatAmountSar { get; set; }
    public DateTime? UpdatedAtUtc { get; set; }
}

public sealed class CreatePartyFeePricingTableRequest
{
    public string Category { get; set; } = "";
    public string Name { get; set; } = "";

    /// <summary>Optional; defaults from category. Use <c>flat</c> for employee incentives.</summary>
    public string? PricingKind { get; set; }

    /// <summary>Optional; defaults to system-admin. Flat tables may be supervisor-managed.</summary>
    public string? ManagedBy { get; set; }

    public decimal? FlatAmountSar { get; set; }

    /// <summary>Optional source table to clone fees/tiers from.</summary>
    public Guid? CopyFromTableId { get; set; }
}

public sealed class IncentiveSuspensionDto
{
    public string Id { get; set; } = "";
    public string UserId { get; set; } = "";
    public string AssigneeId { get; set; } = "";
    public string TransactionKey { get; set; } = "";
    public string Reason { get; set; } = "";
    public bool IsActive { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime? LiftedAtUtc { get; set; }
}

public sealed class CreateIncentiveSuspensionRequest
{
    public required string AssigneeId { get; init; }
    public required string TransactionKey { get; init; }
    public required string Reason { get; init; }
}

public sealed class SetPartyFeePricingAssignmentsRequest
{
    public List<string> AssigneeIds { get; set; } = [];
}
