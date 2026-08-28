using System.ComponentModel.DataAnnotations;
using RealEstateEval.Domain;

namespace RealEstateEval.Application.Contracts;

public class PropertyContactDto
{
    public string Name { get; set; } = "";
    public string Role { get; set; } = "";
    public string Phone { get; set; } = "";
}

public class WorkOrderPropertyDto
{
    public Guid? Id { get; set; }
 /// <summary>ورشة الترقيم: الرقم المرجعي الداخلي للمعاملة TX-{سنة}-{تسلسل ٥} — يملكه الخادم، لا يُكتب من العميل.</summary>
    public string? ReferenceNumber { get; set; }
    public string IdentifierType { get; set; } = "deed";
    public string DeedNumber { get; set; } = "";
    public string? RequestNumber { get; set; }
    public bool HasRequestNumber { get; set; } = true;
    public string? AssignmentMandateNumber { get; set; }
    public string? AssignmentMandateDate { get; set; }
    public string? DeedDate { get; set; }
    public string? RealEstateRegNumber { get; set; }
    public string? RealEstateRegDate { get; set; }
    public string? OwnerName { get; set; }
 /// <summary>deed kind: traditional | registered_title. Empty on write = use suggestion.</summary>
    public string? DeedKind { get; set; }
    public string? DeedKindLabelAr { get; set; }
 /// <summary>Suggestion from the identifier type (real-estate registration → registered title).</summary>
    public string? SuggestedDeedKind { get; set; }
 /// <summary>الملاك وحصصهم — deed transcription.</summary>
    public List<DeedOwnerDto> Owners { get; set; } = [];
 /// <summary>Effective نوع الملكية (manual override or derived).</summary>
    public string? OwnershipType { get; set; }
    public string? OwnershipTypeLabelAr { get; set; }
 /// <summary>Derived suggestion (رهن→مرهون · حصص→مشاع · else مطلقة).</summary>
    public string? SuggestedOwnershipType { get; set; }
    public bool OwnershipTypeIsManual { get; set; }
    public string? RestrictionsPresent { get; set; }
    public string? RestrictionType { get; set; }
    public string? RestrictionOtherReason { get; set; }
    public string? BoundariesAvailability { get; set; }
    public string? BoundariesExternalDocName { get; set; }
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
    public string City { get; set; } = "";
    public string? Region { get; set; }
    public string District { get; set; } = "";
    public string? DeedStatus { get; set; }
    public string? Area { get; set; }
    public string? Court { get; set; }
    public string? Circuit { get; set; }
    public Guid? CourtId { get; set; }
    public Guid? CircuitId { get; set; }
    public Guid? RegionId { get; set; }
    public Guid? CityId { get; set; }
    public string Classification { get; set; } = "";
    public string PropertyType { get; set; } = "";
    public List<string> AssignmentDocFileNames { get; set; } = [];
    public List<string> DelegationLetterFileNames { get; set; } = [];
    public List<string> OtherDocumentFileNames { get; set; } = [];
    public string? RealEstateRegFileName { get; set; }
    public string? DeedOwnershipFileName { get; set; }
    public string? BourseDeedImageFileName { get; set; }
    public bool BourseDataCompleted { get; set; }
    public string? PlanNumber { get; set; }
    public string? PlanName { get; set; }
    public string? PlotNumber { get; set; }
    public string? BlockNumber { get; set; }
    public string? LocationMapUrl { get; set; }
    public string? PartitionMinutesNumber { get; set; }
    public string? PartitionMinutesDate { get; set; }
    public string? FinishingType { get; set; }
    public string? FinishingStructure { get; set; }
    public bool IsRemoved { get; set; }
    public string? RemovalReason { get; set; }
    public string? RemovedAtUtc { get; set; }
    public List<PropertyContactDto> Contacts { get; set; } = [];
}

public class WorkOrderDto
{
    public Guid Id { get; set; }
    public string PoNumber { get; set; } = "";
    public string AssignmentType { get; set; } = "";
    public string PromulgationDate { get; set; } = "";
    public string ReceivedFromEnfathAt { get; set; } = "";
    public string? ReceivedFromEnfathTime { get; set; }
    public string? AssignmentSpecialist { get; set; }
    public string? AssignmentSpecialistEmail { get; set; }
    public int ExpectedPropertyCount { get; set; }
    public string DueDateAt { get; set; } = "";
    public string CreatedAtUtc { get; set; } = "";
    public string? PropertiesRegion { get; set; }
    public string? WorkOrderDescription { get; set; }
    public Guid? ClientId { get; set; }
    public string? ClientNameAr { get; set; }
 /// <summary>report users (0..n) from the client registry.</summary>
    public List<Guid> ReportUserClientIds { get; set; } = [];
    public List<WorkOrderPropertyDto> Properties { get; set; } = [];
}

public class CreateWorkOrderRequest
{
    [Required]
    public string PoNumber { get; set; } = "";

    [Required]
    public string AssignmentType { get; set; } = "";

    [Required]
    public string PromulgationDate { get; set; } = "";

    public string? ReceivedFromEnfathTime { get; set; }

    public string? AssignmentSpecialist { get; set; }

    public string? AssignmentSpecialistEmail { get; set; }

    [Range(1, 999)]
    public int ExpectedPropertyCount { get; set; } = 1;

    [MaxLength(256)]
    public string? PropertiesRegion { get; set; }

    [MaxLength(2000)]
    public string? WorkOrderDescription { get; set; }

 /// <summary>Registered client — required before opening a work order.</summary>
    [Required]
    public Guid ClientId { get; set; }

 /// <summary>report users (0..n); may include the client.</summary>
    public List<Guid>? ReportUserClientIds { get; set; }

    public List<WorkOrderPropertyDto> Properties { get; set; } = [];
}

public class UpdateWorkOrderHeaderRequest
{
    [Required]
    public string AssignmentType { get; set; } = "";

    [Required]
    public string PromulgationDate { get; set; } = "";

    public string? ReceivedFromEnfathTime { get; set; }

    public string? AssignmentSpecialist { get; set; }

    public string? AssignmentSpecialistEmail { get; set; }

    [Range(1, 999)]
    public int ExpectedPropertyCount { get; set; } = 1;

    [MaxLength(256)]
    public string? PropertiesRegion { get; set; }

    [MaxLength(2000)]
    public string? WorkOrderDescription { get; set; }

    [Required]
    public Guid ClientId { get; set; }

 /// <summary>report users (0..n); may include the client.</summary>
    public List<Guid>? ReportUserClientIds { get; set; }
}

public class UpdatePropertyBourseRequest
{
    public string City { get; set; } = "";
    public string? Region { get; set; }
    public Guid? RegionId { get; set; }
    public Guid? CityId { get; set; }
    public string District { get; set; } = "";
    public string Classification { get; set; } = "";
    public string PropertyType { get; set; } = "";
    public string? Area { get; set; }
    public string? DeedStatus { get; set; }
    public string? BourseDeedImageFileName { get; set; }
 /// <summary>الملاك وحصصهم — replaces the whole list when provided.</summary>
    public List<DeedOwnerDto>? Owners { get; set; }
 /// <summary>Manual نوع الملكية override; requires OwnershipTypeIsManual.</summary>
    public string? OwnershipType { get; set; }
    public bool OwnershipTypeIsManual { get; set; }
    public string? RestrictionsPresent { get; set; }
    public string? RestrictionType { get; set; }
    public string? RestrictionOtherReason { get; set; }
    public string? BoundariesAvailability { get; set; }
    public string? BoundariesExternalDocName { get; set; }
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
}

public class PropertyListRowDto
{
    public string Id { get; set; } = "";
    public string Po { get; set; } = "";
    public string Area { get; set; } = "";
    public string Type { get; set; } = "";
    public bool Key { get; set; }
    public string Survey { get; set; } = PropertyListRowStatuses.New;
    public string Val { get; set; } = PropertyListRowStatuses.New;
    public string Study { get; set; } = PropertyListRowStatuses.New;
    public string Status { get; set; } = PropertyListRowStatuses.New;
    public string Specialist { get; set; } = "";
}

public class PropertyListItemDto
{
    public PropertyListRowDto Row { get; set; } = new();
    public string PoNumber { get; set; } = "";
    public string PropertyId { get; set; } = "";
}

public class WorkOrderListItemDto
{
    public string PoNumber { get; set; } = "";
    public string AssignmentType { get; set; } = "";
 /// <summary>Properties actually registered in the system.</summary>
    public int PropertyCount { get; set; }
 /// <summary>Property count from Infath at promulgation.</summary>
    public int ExpectedPropertyCount { get; set; }
    public int CompletedCount { get; set; }
    public string Status { get; set; } = WorkOrderListStatus.New;
    public string PromulgationDate { get; set; } = "";
    public string ReceivedFromEnfathAt { get; set; } = "";
    public string DueDateAt { get; set; } = "";
    public string? AssignmentSpecialist { get; set; }
    public string? WorkOrderDescription { get; set; }
    public string? PropertiesRegion { get; set; }
    public string CreatedAtUtc { get; set; } = "";
}

public class PriorDeedRegistrationDto
{
    public string PoNumber { get; set; } = "";
 /// <summary>Source property id (for deep links on prior studies).</summary>
    public Guid PropertyId { get; set; }
    public string DeedNumber { get; set; } = "";
    public string IdentifierType { get; set; } = "deed";
    public string? DeedDate { get; set; }
    public string? OwnerName { get; set; }
    public string? RequestNumber { get; set; }
    public string? AssignmentMandateNumber { get; set; }
    public string? AssignmentMandateDate { get; set; }
    public string? Court { get; set; }
    public string? Circuit { get; set; }
    public Guid? CourtId { get; set; }
    public Guid? CircuitId { get; set; }
    public List<PropertyContactDto> Contacts { get; set; } = [];
    public string? Region { get; set; }
    public Guid? RegionId { get; set; }
    public string? City { get; set; }
    public Guid? CityId { get; set; }
    public string? District { get; set; }
    public string? Classification { get; set; }
    public string? PropertyType { get; set; }
    public string? Area { get; set; }
    public string? DeedStatus { get; set; }
    public string? RestrictionsPresent { get; set; }
    public string? RestrictionType { get; set; }
    public string? RestrictionOtherReason { get; set; }
    public string? BoundariesAvailability { get; set; }
    public string? BoundariesExternalDocName { get; set; }
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
    public string? PlanNumber { get; set; }
    public string? PlanName { get; set; }
    public string? PlotNumber { get; set; }
    public string? BlockNumber { get; set; }
    public string? LocationMapUrl { get; set; }
    public string? PartitionMinutesNumber { get; set; }
    public string? PartitionMinutesDate { get; set; }
    public string? FinishingType { get; set; }
    public string? FinishingStructure { get; set; }
    public bool BourseDataCompleted { get; set; }
 /// <summary>Work-order creation timestamp (UTC ISO) for prior-study ordering.</summary>
    public string? WorkOrderCreatedAtUtc { get; set; }

 /// <summary>Prior study document file names — client re-clones attachment bytes onto the new property.</summary>
    public List<string> AssignmentDocFileNames { get; set; } = [];
    public List<string> DelegationLetterFileNames { get; set; } = [];
    public List<string> OtherDocumentFileNames { get; set; } = [];
    public string? RealEstateRegFileName { get; set; }
    public string? DeedOwnershipFileName { get; set; }
    public string? BourseDeedImageFileName { get; set; }
    public string? RealEstateRegNumber { get; set; }
    public string? RealEstateRegDate { get; set; }
    public bool HasRequestNumber { get; set; } = true;
}

public class UpdateLocationMapUrlRequest
{
    public string? LocationMapUrl { get; set; }
}

public class DeleteWorkOrderPropertyRequest
{
    [MaxLength(500)]
    public string Reason { get; set; } = "";
}

public class PendingBoursePropertyDto
{
    public string PoNumber { get; set; } = "";
    public Guid PropertyId { get; set; }
    public string IdentifierType { get; set; } = "deed";
    public string DeedNumber { get; set; } = "";
    public string? DeedDate { get; set; }
    public string? OwnerName { get; set; }
    public string? RequestNumber { get; set; }
    public string AssignmentType { get; set; } = "";
    public string ReceivedFromEnfathAt { get; set; } = "";
    public string DueDateAt { get; set; } = "";
 /// <summary>PO creation time (UTC ISO) — used for newest-first queue order.</summary>
    public string CreatedAtUtc { get; set; } = "";
}

// Courts-catalog DTOs moved to RealEstateEval.Platform.Application (A8).

/// <summary>One deed owner (الملاك وحصصهم) — share optional for single-owner deeds.</summary>
public class DeedOwnerDto
{
    public string Name { get; set; } = "";
 /// <summary>Share % in (0, 100]; null = unstated.</summary>
    public decimal? SharePct { get; set; }
}
