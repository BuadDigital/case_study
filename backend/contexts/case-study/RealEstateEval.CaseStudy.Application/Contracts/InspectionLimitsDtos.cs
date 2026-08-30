using System.ComponentModel.DataAnnotations;

namespace RealEstateEval.CaseStudy.Application.Contracts;

public class UninspectedUnitEntryDto
{
    public int Count { get; init; }
    public string Reason { get; init; } = "";
}

/// <summary>Inspection Limitations (Decision 24 + Q-7) — structured inputs packaged by Inspector.</summary>
public class InspectionLimitsDto
{
    public Guid PropertyId { get; init; }
 /// <summary>full| external | desktop | “(Not captured yet).</summary>
    public string InspectionScopeKey { get; init; } = "";
    public string InspectionScopeLabelAr { get; init; } = "";
    public string? InspectionRestrictionReason { get; init; }
    public IReadOnlyList<UninspectedUnitEntryDto> UninspectedUnits { get; init; } = [];
    public int TotalUninspectedUnits { get; init; }
 /// <summary>Automatically compounded reservation text — placed within Special Assumptions.</summary>
    public string ReservationTextAr { get; init; } = "";
 /// <summary>Q-7 — certified appraiser approval for the “remote desktop” scope.</summary>
    public string? RemoteInspectionApprovedBy { get; init; }
    public string? RemoteInspectionApprovedAtUtc { get; init; }
    public bool RemoteInspectionApproved { get; init; }
}

public class SaveInspectionLimitsRequest
{
    [Required, MaxLength(16)]
    public string InspectionScopeKey { get; init; } = "";

    [MaxLength(2000)]
    public string? InspectionRestrictionReason { get; init; }

    public IReadOnlyList<UninspectedUnitEntryDto> UninspectedUnits { get; init; } = [];
}
