using System.ComponentModel.DataAnnotations;

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
    public string IdentifierType { get; set; } = "deed";
    public string DeedNumber { get; set; } = "";
    public string? TaskNumber { get; set; }
    public string? DeedDate { get; set; }
    public string? OwnerName { get; set; }
    public string? RestrictionsPresent { get; set; }
    public string? BoundariesAvailability { get; set; }
    public string? BoundariesExternalDocName { get; set; }
    public string? NorthBoundary { get; set; }
    public string? NorthBoundaryLengthM { get; set; }
    public string? SouthBoundary { get; set; }
    public string? SouthBoundaryLengthM { get; set; }
    public string? EastBoundary { get; set; }
    public string? EastBoundaryLengthM { get; set; }
    public string? WestBoundary { get; set; }
    public string? WestBoundaryLengthM { get; set; }
    public string City { get; set; } = "";
    public string District { get; set; } = "";
    public string? DeedStatus { get; set; }
    public string? Area { get; set; }
    public string? Court { get; set; }
    public string? Circuit { get; set; }
    public string Classification { get; set; } = "";
    public string PropertyType { get; set; } = "";
    public string? AssignmentDocFileName { get; set; }
    public string? DelegationLetterFileName { get; set; }
    public List<string> OtherDocumentFileNames { get; set; } = [];
    public string? RealEstateRegFileName { get; set; }
    public bool BourseDataCompleted { get; set; }
    public string? BuildLicenseNumber { get; set; }
    public string? SubdivisionRecordNumber { get; set; }
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
}

public class UpdatePropertyBourseRequest
{
    public string City { get; set; } = "";
    public string District { get; set; } = "";
    public string Classification { get; set; } = "";
    public string PropertyType { get; set; } = "";
    public string? Area { get; set; }
    public string? DeedStatus { get; set; }
    public string? RestrictionsPresent { get; set; }
    public string? BoundariesAvailability { get; set; }
    public string? BoundariesExternalDocName { get; set; }
    public string? NorthBoundary { get; set; }
    public string? NorthBoundaryLengthM { get; set; }
    public string? SouthBoundary { get; set; }
    public string? SouthBoundaryLengthM { get; set; }
    public string? EastBoundary { get; set; }
    public string? EastBoundaryLengthM { get; set; }
    public string? WestBoundary { get; set; }
    public string? WestBoundaryLengthM { get; set; }
    public string? BuildLicenseNumber { get; set; }
    public string? SubdivisionRecordNumber { get; set; }
}

public class PropertyListRowDto
{
    public string Id { get; set; } = "";
    public string Po { get; set; } = "";
    public string Area { get; set; } = "";
    public string Type { get; set; } = "";
    public bool Key { get; set; }
    public string Survey { get; set; } = "new";
    public string Val { get; set; } = "new";
    public string Study { get; set; } = "new";
    public string Status { get; set; } = "new";
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
    /// <summary>عقارات مسجّلة فعلياً في النظام.</summary>
    public int PropertyCount { get; set; }
    /// <summary>عدد العقارات الوارد من إنفاذ عند التعميد.</summary>
    public int ExpectedPropertyCount { get; set; }
    public int CompletedCount { get; set; }
    public string Status { get; set; } = "progress";
    public string PromulgationDate { get; set; } = "";
    public string ReceivedFromEnfathAt { get; set; } = "";
    public string DueDateAt { get; set; } = "";
    public string? AssignmentSpecialist { get; set; }
    public string CreatedAtUtc { get; set; } = "";
}

public class PriorDeedRegistrationDto
{
    public string PoNumber { get; set; } = "";
    public string? DeedDate { get; set; }
    public string? OwnerName { get; set; }
    public List<PropertyContactDto> Contacts { get; set; } = [];
    public string? City { get; set; }
    public string? District { get; set; }
    public string? Classification { get; set; }
    public string? PropertyType { get; set; }
    public string? Area { get; set; }
    public string? DeedStatus { get; set; }
    public string? RestrictionsPresent { get; set; }
    public string? BoundariesAvailability { get; set; }
    public string? BoundariesExternalDocName { get; set; }
    public string? NorthBoundary { get; set; }
    public string? NorthBoundaryLengthM { get; set; }
    public string? SouthBoundary { get; set; }
    public string? SouthBoundaryLengthM { get; set; }
    public string? EastBoundary { get; set; }
    public string? EastBoundaryLengthM { get; set; }
    public string? WestBoundary { get; set; }
    public string? WestBoundaryLengthM { get; set; }
    public string? BuildLicenseNumber { get; set; }
    public string? SubdivisionRecordNumber { get; set; }
}

public class PendingBoursePropertyDto
{
    public string PoNumber { get; set; } = "";
    public Guid PropertyId { get; set; }
    public string IdentifierType { get; set; } = "deed";
    public string DeedNumber { get; set; } = "";
    public string? DeedDate { get; set; }
    public string? OwnerName { get; set; }
    public string? TaskNumber { get; set; }
    public string AssignmentType { get; set; } = "";
    public string ReceivedFromEnfathAt { get; set; } = "";
    public string DueDateAt { get; set; } = "";
}

public class CourtCatalogEntryDto
{
    public Guid Id { get; set; }
    public string City { get; set; } = "";
    public string Court { get; set; } = "";
    public List<string> Circuits { get; set; } = [];
}

public class SaveCourtsCatalogRequest
{
    public List<CourtCatalogEntryDto> Entries { get; set; } = [];
}
