namespace RealEstateEval.Domain;

/// <summary>
/// Denormalized field-inspection workspace row for SQL reporting and dashboards.
/// Source of truth remains <see cref="PartyTaskSubmission.PayloadJson"/>.
/// </summary>
public class FieldInspectionWorkspace
{
    public Guid WorkflowTaskId { get; set; }
    public Guid PartyTaskSubmissionId { get; set; }
    public Guid? PropertyId { get; set; }
    public string? PoNumber { get; set; }
    public DateOnly? InspectionDate { get; set; }
    public string? InspectionTime { get; set; }
    public decimal? MapLatitude { get; set; }
    public decimal? MapLongitude { get; set; }
    public bool InspectionConfirmed { get; set; }
    public string Status { get; set; } = PartyTaskSubmissionStatus.Draft;
    public int RequiredPhotoSlots { get; set; }
    public int CompletedPhotoSlots { get; set; }
    public int PendingPhotoApprovals { get; set; }
    public int ObservationCount { get; set; }
    public int AttachmentCount { get; set; }
    public DateTime? SubmittedAtUtc { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
}
