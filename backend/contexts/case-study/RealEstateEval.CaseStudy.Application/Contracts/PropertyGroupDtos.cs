using System.ComponentModel.DataAnnotations;

namespace RealEstateEval.CaseStudy.Application.Contracts;

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

    /// <summary>What the link just copied between the two deeds; null on a plain read.</summary>
    public PropertyGroupLinkSyncDto? LinkSync { get; init; }
}

/// <summary>
/// The data copied once at the link (decision 2026-10-15): into empty slots only, both ways.
/// "Subject" is the deed the link was confirmed from, "target" the one it was linked to.
/// </summary>
public class PropertyGroupLinkSyncDto
{
    public IReadOnlyList<string> SubjectFieldsFilled { get; init; } = [];
    public IReadOnlyList<string> TargetFieldsFilled { get; init; } = [];
    public bool ContactsCopiedToSubject { get; init; }
    public bool ContactsCopiedToTarget { get; init; }
    public int InspectorSlotsFilledOnSubject { get; init; }
    public int InspectorSlotsFilledOnTarget { get; init; }
}

/// <summary>
/// The stored names of the documents the screen copied onto a linked deed (the bytes live in
/// the attachments service, which the screen drives). Only empty name slots are filled.
/// </summary>
public class FillPropertyGroupDocumentNamesRequest
{
    public List<string> AssignmentDocFileNames { get; init; } = [];
    public List<string> DelegationLetterFileNames { get; init; } = [];
    public List<string> OtherDocumentFileNames { get; init; } = [];
    [MaxLength(512)]
    public string? RealEstateRegFileName { get; init; }
    [MaxLength(512)]
    public string? DeedOwnershipFileName { get; init; }
    [MaxLength(512)]
    public string? BourseDeedImageFileName { get; init; }
    [MaxLength(512)]
    public string? BoundariesExternalDocName { get; init; }
}

public class FillPropertyGroupDocumentNamesResultDto
{
    public IReadOnlyList<string> Filled { get; init; } = [];
}

/// <summary>What the sibling deed's inspection gave this deed's inspection draft (decision 2026-10-18).</summary>
public class InspectionPrefillResultDto
{
    public bool Prefilled { get; init; }
    public int SlotsFilled { get; init; }
    public int PhotosLinked { get; init; }
    public string? SourceTaskId { get; init; }
    /// <summary>Why nothing was filled, in Arabic; null when it was.</summary>
    public string? Reason { get; init; }
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
 /// <summary>Unlockable with justification — required.</summary>
    [Required, MaxLength(2000)]
    public string Reason { get; init; } = "";
}
