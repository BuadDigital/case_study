namespace RealEstateEval.Domain;

public class WorkOrderProperty
{
    public Guid Id { get; set; }
    public Guid WorkOrderId { get; set; }
    public PropertyIdentifierType IdentifierType { get; set; }
    public string DeedNumber { get; set; } = "";
    /// <summary>رقم الطلب (كان سابقاً رقم المهمة).</summary>
    public string? RequestNumber { get; set; }
    /// <summary>رقم التكليف — بيانات أولية إلزامية.</summary>
    public string? AssignmentMandateNumber { get; set; }
    /// <summary>تاريخ التكليف — بيانات أولية إلزامية (yyyy-MM-dd).</summary>
    public string? AssignmentMandateDate { get; set; }
    public string? DeedDate { get; set; }
    public string? OwnerName { get; set; }
    /// <summary>yes / no — القيود على العقار (مرحلة البورصة).</summary>
    public string? RestrictionsPresent { get; set; }
    /// <summary>mortgaged / seized / suspended / other — نوع القيد عند وجود قيود.</summary>
    public string? RestrictionType { get; set; }
    /// <summary>سبب القيد عند اختيار «أخرى».</summary>
    public string? RestrictionOtherReason { get; set; }
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
    public DateTime? BourseCompletedAtUtc { get; set; }
    /// <summary>رقم المخطط — بيانات أولية.</summary>
    public string? PlanNumber { get; set; }
    /// <summary>رقم القطعة — بيانات أولية.</summary>
    public string? PlotNumber { get; set; }
    /// <summary>رابط خريطة الموقع — مطلوب لفتح العشوائيات.</summary>
    public string? LocationMapUrl { get; set; }

    /// <summary>حذف ناعم من طوابير المعاملات — يبقى ظاهراً في قائمة عقارات أمر العمل.</summary>
    public bool IsRemoved { get; set; }

    /// <summary>سبب الحذف — يُعرض في قائمة العقارات.</summary>
    public string? RemovalReason { get; set; }

    public DateTime? RemovedAtUtc { get; set; }

    public WorkOrder? WorkOrder { get; set; }
    public ICollection<PropertyContact> Contacts { get; set; } = [];
}
