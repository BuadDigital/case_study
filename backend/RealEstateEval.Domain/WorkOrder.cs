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

    public static WorkOrder CreateHeader(
        Guid id,
        string poNumber,
        AssignmentType assignmentType,
        DateOnly promulgationDate,
        DateOnly receivedFromEnfathAt,
        string? receivedFromEnfathTime,
        string? assignmentSpecialist,
        string? assignmentSpecialistEmail,
        int expectedPropertyCount,
        string? propertiesRegion,
        string? workOrderDescription,
        DateOnly dueDateAt,
        DateTime createdAtUtc) =>
        new()
        {
            Id = id,
            PoNumber = poNumber,
            AssignmentType = assignmentType,
            PromulgationDate = promulgationDate,
            ReceivedFromEnfathAt = receivedFromEnfathAt,
            ReceivedFromEnfathTime = receivedFromEnfathTime,
            AssignmentSpecialist = assignmentSpecialist,
            AssignmentSpecialistEmail = assignmentSpecialistEmail,
            ExpectedPropertyCount = expectedPropertyCount,
            PropertiesRegion = propertiesRegion,
            WorkOrderDescription = workOrderDescription,
            DueDateAt = dueDateAt,
            CreatedAtUtc = createdAtUtc,
        };

    /// <summary>
    /// Apply a manual lifecycle override. Returns an Arabic error when the edge is illegal,
    /// or null on success.
    /// </summary>
    public string? TrySetLifecycleStatus(string lifecycleStatus, string alreadyAppliedMessage)
    {
        if (string.Equals(LifecycleStatus, lifecycleStatus, StringComparison.Ordinal))
            return alreadyAppliedMessage;

        if (lifecycleStatus == WorkOrderLifecycleStatus.Stopped
            && LifecycleStatus == WorkOrderLifecycleStatus.Cancelled)
        {
            return "لا يمكن إيقاف أمر عمل ملغى";
        }

        LifecycleStatus = lifecycleStatus;
        return null;
    }
}
