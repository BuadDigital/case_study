using System.ComponentModel.DataAnnotations;

namespace RealEstateEval.Application.Contracts;

/// <summary>grouped-property link member for display.</summary>
public class PropertyGroupMemberDto
{
    public Guid PropertyId { get; init; }
    public string PoNumber { get; init; } = "";
    public string DeedNumber { get; init; } = "";
    public string? DeedKind { get; init; }
    public string LinkedByUserId { get; init; } = "";
    public string LinkedAtUtc { get; init; } = "";
    public IReadOnlyList<string> SignalLabelsAr { get; init; } = [];
}

public class PropertyGroupDto
{
    public Guid Id { get; init; }
    public string? Name { get; init; }
    public string CreatedAtUtc { get; init; } = "";
    public IReadOnlyList<PropertyGroupMemberDto> Members { get; init; } = [];
}

/// <summary>stage-1 — suggested candidate with its signals.</summary>
public class PropertyGroupSuggestionDto
{
    public Guid PropertyId { get; init; }
    public string PoNumber { get; init; } = "";
    public string DeedNumber { get; init; } = "";
    public string? OwnerName { get; init; }
    public string? PlanNumber { get; init; }
    public string? PlotNumber { get; init; }
    public IReadOnlyList<string> SignalCodes { get; init; } = [];
    public IReadOnlyList<string> SignalLabelsAr { get; init; } = [];
 /// <summary>Already in a group — confirming joins that group.</summary>
    public Guid? ExistingGroupId { get; init; }
}

public class ConfirmPropertyGroupLinkRequest
{
    [Required]
    public Guid TargetPropertyId { get; init; }
}

public class UnlinkPropertyGroupRequest
{
 /// <summary>قابل للفك بمبرر — required.</summary>
    [Required, MaxLength(2000)]
    public string Reason { get; init; } = "";
}
