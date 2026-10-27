using RealEstateEval.Domain;
using RealEstateEval.CaseStudy.Domain;

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
    /// <summary>Work-order basis of value — source for the final-opinion screen.</summary>
    public string? BasisOfValueKey { get; set; }
    /// <summary>Work-order value premise — source for the final-opinion screen.</summary>
    public string? ValuePremiseKey { get; set; }

    public string IdentifierType { get; set; } = "";
    public string DeedKind { get; set; } = "";
    public string DeedNumber { get; set; } = "";
    public string? RealEstateRegNumber { get; set; }
    /// <summary>
    /// False for registered title, approved organizational plan, or unit-inside-building.
    /// Issuance must not require the engineering-survey print attachment when this is false.
    /// </summary>
    public bool RequiresEngineeringSurvey { get; set; } = true;
    /// <summary>
    /// The property's engineering-survey task ids (and the study holder's, for a linked deed): the
    /// surveyor uploads «التقرير المساحي» under the task, not the property, so the issuance gate also
    /// looks there. Only tasks whose package the office has SUBMITTED are listed — an upload to a
    /// draft does not count as the survey. Empty from a host that predates the field.
    /// </summary>
    public IReadOnlyList<Guid> SurveyTaskIds { get; set; } = [];
    public string? DeedDate { get; set; }
    public string? OwnerName { get; set; }
    public string? DeedOwnersJson { get; set; }
    public string? RestrictionsPresent { get; set; }
    public string? RestrictionType { get; set; }
    public string? RestrictionOtherReason { get; set; }

    public string City { get; set; } = "";
    public string? Region { get; set; }
    public string District { get; set; } = "";
    public string? Area { get; set; }
    public string Classification { get; set; } = "";
    /// <summary>Initial type captured before field inspection.</summary>
    public string PropertyType { get; set; } = "";
    /// <summary>Type confirmed when the field inspector submitted the inspection.</summary>
    public string? InspectedPropertyType { get; set; }
    /// <summary>
    /// «الأصل محل التقييم» as the inspector's latest DRAFT states it (his package is not submitted yet,
    /// so <see cref="InspectedPropertyType"/> is still empty). Lets the appraiser's unsaved approach
    /// defaults follow the inspected type while the inspection is in progress; saved settings are never rewritten.
    /// </summary>
    public string? DraftInspectedPropertyType { get; set; }

    /// <summary>Submitted inspected type, else the inspector's draft type, else the intake type.</summary>
    public string EffectivePropertyType() =>
        !string.IsNullOrWhiteSpace(InspectedPropertyType)
            ? InspectedPropertyType.Trim()
            : !string.IsNullOrWhiteSpace(DraftInspectedPropertyType)
                ? DraftInspectedPropertyType.Trim()
                : PropertyType.Trim();
    public string? PlanNumber { get; set; }
    public string? PlanName { get; set; }
    public string? PlotNumber { get; set; }
    public string? BlockNumber { get; set; }
    public string? PartitionMinutesNumber { get; set; }
    public string? PartitionMinutesDate { get; set; }

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

    /// <summary>The scoping answer «are there buildings/structures to value?» is yes.</summary>
    public bool HasStructures() =>
        string.Equals(HasStructuresToValue.Trim(), "yes", StringComparison.OrdinalIgnoreCase);

 /// <summary>«مكونات العقار» written by the case specialist — the report's «وصف العقار».</summary>
    public string? SpecialistComponentsText { get; set; }

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

    /// <summary>
    /// The latest non-party case-study report of the property is issued — a defensive mirror of the
    /// appraiser's submit gate, enforced again at valuation issuance. False when there is no report;
    /// null only when the case-study host that answered predates the field (rolling deploy), which the
    /// gate reads as «unknown» and does not block.
    /// </summary>
    public bool? StudyReportIssued { get; set; }

    public string? ClientNameAr { get; set; }
    public string? ClientNameEn { get; set; }
    public IReadOnlyList<string> ReportUserClientNamesAr { get; set; } = [];

    // Phase 5: the transaction above the deeds. One valuation covers every
    // deed, so the report lists them all; empty for a host that predates the field.
    public Guid? TransactionId { get; set; }
    /// <summary>PR-… once confirmed, else the TMP- temporary number.</summary>
    public string? TransactionNumber { get; set; }
    public string? TransactionLinkKind { get; set; }
    /// <summary>The deed whose tasks carry the transaction's study and valuation.</summary>
    public Guid? StudyHolderPropertyId { get; set; }
    public IReadOnlyList<CaseStudyTransactionDeedDto> TransactionDeeds { get; set; } = [];

    /// <summary>True when the transaction has several live deeds (a linked property).</summary>
    public bool IsLinkedProperty => TransactionDeeds.Count(d => !d.IsRemoved) > 1;

    public Domain.DeedKind DeedKindValue() =>
        DeedKindLabels.TryParseApiValue(DeedKind, out var parsed)
            ? parsed
            : Enum.TryParse<Domain.DeedKind>(DeedKind, ignoreCase: true, out var kind)
                ? kind
                : Domain.DeedKind.Traditional;

    public Domain.PropertyIdentifierType IdentifierTypeValue() =>
        PropertyIdentifierTypeLabels.TryParseApiValue(IdentifierType, out var type)
            ? type
            : Domain.PropertyIdentifierType.Deed;

    public Domain.AssignmentType AssignmentTypeValue() =>
        AssignmentTypeLabels.TryParseLabel(AssignmentType, out var type)
            ? type
            : Domain.AssignmentType.Execution;

    public WorkOrderProperty ToProperty() => new()
    {
        Id = Id,
        WorkOrderId = WorkOrderId,
        IdentifierType = IdentifierTypeValue(),
        DeedKind = DeedKindValue(),
        DeedNumber = DeedNumber,
        RealEstateRegNumber = RealEstateRegNumber,
        DeedDate = DeedDate,
        OwnerName = OwnerName,
        DeedOwnersJson = DeedOwnersJson,
        RestrictionsPresent = RestrictionsPresent,
        RestrictionType = RestrictionType,
        RestrictionOtherReason = RestrictionOtherReason,
        City = City,
        Region = Region,
        District = District,
        Area = Area,
        Classification = Classification,
        PropertyType = EffectivePropertyType(),
        PlanNumber = PlanNumber,
        PlanName = PlanName,
        PlotNumber = PlotNumber,
        BlockNumber = BlockNumber,
        PartitionMinutesNumber = PartitionMinutesNumber,
        PartitionMinutesDate = PartitionMinutesDate,
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
        SpecialistComponentsText = SpecialistComponentsText,
        InspectionScopeKey = InspectionScopeKey,
        InspectionRestrictionReason = InspectionRestrictionReason,
        UninspectedUnitsJson = UninspectedUnitsJson,
        RemoteInspectionApprovedAtUtc = RemoteInspectionApprovedAtUtc,
        BuildingInventoryLines = BuildingInventoryLines
            .Select(line => line.ToLine(Id))
            .ToList(),
    };
}

/// <summary>One deed of the transaction as the valuation report prints it.</summary>
public sealed class CaseStudyTransactionDeedDto
{
    public Guid PropertyId { get; set; }
    public string PoNumber { get; set; } = "";
    public string IdentifierType { get; set; } = "";
    public string DeedNumber { get; set; } = "";
    public string? DeedDate { get; set; }
    public string? RealEstateRegNumber { get; set; }
    public string? RealEstateRegDate { get; set; }
    public string? Area { get; set; }
    public string? OwnerName { get; set; }
    public string? PlotNumber { get; set; }
    public string? PlanNumber { get; set; }
    public bool IsRemoved { get; set; }

    /// <summary>Registry number when the deed is identified by one, else the deed number.</summary>
    public string Label()
    {
        var registry = RealEstateRegNumber?.Trim();
        if (IdentifierType == "real_estate_reg" && !string.IsNullOrWhiteSpace(registry)) return registry!;
        return !string.IsNullOrWhiteSpace(DeedNumber) ? DeedNumber.Trim() : registry ?? "";
    }

    /// <summary>The registry date for a registry deed, else the deed date.</summary>
    public string? DateLabel() =>
        IdentifierType == "real_estate_reg" && !string.IsNullOrWhiteSpace(RealEstateRegDate)
            ? RealEstateRegDate
            : DeedDate;
}

/// <summary>How a linked property's deeds print in one report cell.</summary>
public static class CaseStudyTransactionDeedRules
{
    public const string Separator = " ، ";

    /// <summary>Every live deed's label joined; null when the transaction is not a linked property.</summary>
    public static string? JoinedLabels(IReadOnlyList<CaseStudyTransactionDeedDto> deeds)
    {
        var live = deeds.Where(d => !d.IsRemoved).Select(d => d.Label()).Where(l => l.Length > 0).ToList();
        return live.Count > 1 ? string.Join(Separator, live) : null;
    }

    /// <summary>Every distinct live deed date joined, in deed order; null when not a linked property.</summary>
    public static string? JoinedDates(IReadOnlyList<CaseStudyTransactionDeedDto> deeds)
    {
        var live = deeds.Where(d => !d.IsRemoved).ToList();
        if (live.Count < 2) return null;
        var dates = live.Select(d => d.DateLabel()?.Trim() ?? "").Select(d => d.Length == 0 ? "—" : d).ToList();
        return string.Join(Separator, dates);
    }
}

public sealed class CaseStudyBuildingInventoryLineDto
{
    public int SortOrder { get; set; }
    public string StructureKind { get; set; } = "";
    public string Label { get; set; } = "";
    public string? AreaSqm { get; set; }
    public string? Notes { get; set; }
    public string? ItemKey { get; set; }
    public string? Unit { get; set; }
    public decimal? BuildRatioPct { get; set; }
    public int? RepeatedFloorCount { get; set; }

    public BuildingInventoryLine ToLine(Guid propertyId) => new()
    {
        PropertyId = propertyId,
        SortOrder = SortOrder,
        StructureKind = StructureKind,
        Label = Label,
        AreaSqm = AreaSqm,
        Notes = Notes,
        ItemKey = ItemKey,
        Unit = Unit,
        BuildRatioPct = BuildRatioPct,
        RepeatedFloorCount = RepeatedFloorCount,
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
