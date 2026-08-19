using RealEstateEval.Domain;

namespace RealEstateEval.Application.Contracts;

/// <summary>
/// Everything the Valuation host reads from Case Study for one property, in one call:
/// the property aggregate (report fill / issuance gates), its building inventory lines,
/// the latest field-inspection workspace + inspector payload, the latest deed↔nature
/// match outcome, and client display names. Read-only — Valuation never writes to
/// Case Study.
/// </summary>
public sealed class CaseStudyValuationPropertyContextDto
{
    public Guid Id { get; set; }
    public Guid WorkOrderId { get; set; }
    public string PoNumber { get; set; } = "";
    public string AssignmentType { get; set; } = "";

    public string DeedKind { get; set; } = "";
    public string DeedNumber { get; set; } = "";
    public string? DeedDate { get; set; }
    public string? OwnerName { get; set; }
    public string? DeedOwnersJson { get; set; }
    public string? OwnershipType { get; set; }
    public bool OwnershipTypeIsManual { get; set; }
    public string? RestrictionsPresent { get; set; }
    public string? RestrictionType { get; set; }
    public string? RestrictionOtherReason { get; set; }

    public string City { get; set; } = "";
    public string? Region { get; set; }
    public string District { get; set; } = "";
    public string? Area { get; set; }
    public string Classification { get; set; } = "";
    public string PropertyType { get; set; } = "";
    public string? PlanNumber { get; set; }
    public string? PlanName { get; set; }
    public string? PlotNumber { get; set; }
    public string? BlockNumber { get; set; }

    public string? NorthBoundary { get; set; }
    public string? NorthBoundaryLengthM { get; set; }
    public string? NorthBoundaryType { get; set; }
    public string? NorthFacadeFinishing { get; set; }
    public string? SouthBoundary { get; set; }
    public string? SouthBoundaryLengthM { get; set; }
    public string? SouthBoundaryType { get; set; }
    public string? SouthFacadeFinishing { get; set; }
    public string? EastBoundary { get; set; }
    public string? EastBoundaryLengthM { get; set; }
    public string? EastBoundaryType { get; set; }
    public string? EastFacadeFinishing { get; set; }
    public string? WestBoundary { get; set; }
    public string? WestBoundaryLengthM { get; set; }
    public string? WestBoundaryType { get; set; }
    public string? WestFacadeFinishing { get; set; }

    public string? FinishingType { get; set; }
    public string? FinishingStructure { get; set; }
    public string HasStructuresToValue { get; set; } = "";

    public string InspectionScopeKey { get; set; } = "";
    public string? InspectionRestrictionReason { get; set; }
    public string? UninspectedUnitsJson { get; set; }
    public DateTime? RemoteInspectionApprovedAtUtc { get; set; }

    public IReadOnlyList<CaseStudyBuildingInventoryLineDto> BuildingInventoryLines { get; set; } = [];

    /// <summary>Latest field-inspection workspace for the property; null when never inspected.</summary>
    public CaseStudyInspectionWorkspaceDto? LatestWorkspace { get; set; }

    /// <summary>PayloadJson of the workspace's party-task submission (inspector facts).</summary>
    public string? InspectorPayloadJson { get; set; }

    /// <summary>DeedNatureMatchOutcome of the latest non-party case-study form; null when none.</summary>
    public string? DeedNatureMatchOutcome { get; set; }

    public string? ClientNameAr { get; set; }
    public string? ClientNameEn { get; set; }
    public IReadOnlyList<string> ReportUserClientNamesAr { get; set; } = [];

    public Domain.DeedKind DeedKindValue() =>
        Enum.TryParse<Domain.DeedKind>(DeedKind, ignoreCase: true, out var kind)
            ? kind
            : Domain.DeedKind.Traditional;

    public Domain.AssignmentType AssignmentTypeValue() =>
        AssignmentTypeLabels.TryParseLabel(AssignmentType, out var type)
            ? type
            : Domain.AssignmentType.Execution;

    public WorkOrderProperty ToProperty() => new()
    {
        Id = Id,
        WorkOrderId = WorkOrderId,
        DeedKind = DeedKindValue(),
        DeedNumber = DeedNumber,
        DeedDate = DeedDate,
        OwnerName = OwnerName,
        DeedOwnersJson = DeedOwnersJson,
        OwnershipType = OwnershipType,
        OwnershipTypeIsManual = OwnershipTypeIsManual,
        RestrictionsPresent = RestrictionsPresent,
        RestrictionType = RestrictionType,
        RestrictionOtherReason = RestrictionOtherReason,
        City = City,
        Region = Region,
        District = District,
        Area = Area,
        Classification = Classification,
        PropertyType = PropertyType,
        PlanNumber = PlanNumber,
        PlanName = PlanName,
        PlotNumber = PlotNumber,
        BlockNumber = BlockNumber,
        NorthBoundary = NorthBoundary,
        NorthBoundaryLengthM = NorthBoundaryLengthM,
        NorthBoundaryType = NorthBoundaryType,
        NorthFacadeFinishing = NorthFacadeFinishing,
        SouthBoundary = SouthBoundary,
        SouthBoundaryLengthM = SouthBoundaryLengthM,
        SouthBoundaryType = SouthBoundaryType,
        SouthFacadeFinishing = SouthFacadeFinishing,
        EastBoundary = EastBoundary,
        EastBoundaryLengthM = EastBoundaryLengthM,
        EastBoundaryType = EastBoundaryType,
        EastFacadeFinishing = EastFacadeFinishing,
        WestBoundary = WestBoundary,
        WestBoundaryLengthM = WestBoundaryLengthM,
        WestBoundaryType = WestBoundaryType,
        WestFacadeFinishing = WestFacadeFinishing,
        FinishingType = FinishingType,
        FinishingStructure = FinishingStructure,
        HasStructuresToValue = HasStructuresToValue,
        InspectionScopeKey = InspectionScopeKey,
        InspectionRestrictionReason = InspectionRestrictionReason,
        UninspectedUnitsJson = UninspectedUnitsJson,
        RemoteInspectionApprovedAtUtc = RemoteInspectionApprovedAtUtc,
        BuildingInventoryLines = BuildingInventoryLines
            .Select(line => line.ToLine(Id))
            .ToList(),
    };
}

public sealed class CaseStudyBuildingInventoryLineDto
{
    public int SortOrder { get; set; }
    public string StructureKind { get; set; } = "";
    public string Label { get; set; } = "";
    public string? AreaSqm { get; set; }

    public BuildingInventoryLine ToLine(Guid propertyId) => new()
    {
        PropertyId = propertyId,
        SortOrder = SortOrder,
        StructureKind = StructureKind,
        Label = Label,
        AreaSqm = AreaSqm,
    };
}

public sealed class CaseStudyInspectionWorkspaceDto
{
    public Guid WorkflowTaskId { get; set; }
    public Guid PartyTaskSubmissionId { get; set; }
    public DateOnly? InspectionDate { get; set; }
    public decimal? MapLatitude { get; set; }
    public decimal? MapLongitude { get; set; }
    public DateTime UpdatedAtUtc { get; set; }

    public FieldInspectionWorkspace ToWorkspace() => new()
    {
        WorkflowTaskId = WorkflowTaskId,
        PartyTaskSubmissionId = PartyTaskSubmissionId,
        InspectionDate = InspectionDate,
        MapLatitude = MapLatitude,
        MapLongitude = MapLongitude,
        UpdatedAtUtc = UpdatedAtUtc,
    };
}
