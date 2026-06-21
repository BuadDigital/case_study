namespace RealEstateEval.Domain;

public class WorkOrderProperty
{
    public Guid Id { get; set; }
    public Guid WorkOrderId { get; set; }
    public PropertyIdentifierType IdentifierType { get; set; }
    public string DeedNumber { get; set; } = "";
    public string? TaskNumber { get; set; }
    public string? DeedDate { get; set; }
    public string? OwnerName { get; set; }
    /// <summary>yes / no — القيود على العقار (مرحلة البورصة).</summary>
    public string? RestrictionsPresent { get; set; }
    /// <summary>deed / bourse / doc / no</summary>
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
    /// <summary>JSON array of filenames.</summary>
    public string? OtherDocumentFileNames { get; set; }
    public string? RealEstateRegFileName { get; set; }
    public bool BourseDataCompleted { get; set; }

    public WorkOrder? WorkOrder { get; set; }
    public ICollection<PropertyContact> Contacts { get; set; } = [];
}
