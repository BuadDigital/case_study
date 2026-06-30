namespace RealEstateEval.Domain;

public class WorkOrder
{
    public Guid Id { get; set; }
    public string PoNumber { get; set; } = "";
    public AssignmentType AssignmentType { get; set; }
    /// <summary>تاريخ التعميد من إنفاذ.</summary>
    public DateOnly PromulgationDate { get; set; }
    public DateOnly ReceivedFromEnfathAt { get; set; }
    public string? ReceivedFromEnfathTime { get; set; }
    public string? AssignmentSpecialist { get; set; }
    public string? AssignmentSpecialistEmail { get; set; }
    /// <summary>عدد العقارات الوارد من إنفاذ عند التعميد.</summary>
    public int ExpectedPropertyCount { get; set; } = 1;
    public DateOnly DueDateAt { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    /// <summary>Manual override: cancelled | stopped — otherwise status is computed.</summary>
    public string? LifecycleStatus { get; set; }
    /// <summary>وصف نصي اختياري — منطقة العقارات.</summary>
    public string? PropertiesRegion { get; set; }
    /// <summary>وصف نصي اختياري — وصف أمر العمل.</summary>
    public string? WorkOrderDescription { get; set; }

    public ICollection<WorkOrderProperty> Properties { get; set; } = [];
}
