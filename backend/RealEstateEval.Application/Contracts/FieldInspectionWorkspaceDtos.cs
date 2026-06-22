namespace RealEstateEval.Application.Contracts;

public class FieldInspectionWorkspaceListItemDto
{
    public string WorkflowTaskId { get; set; } = "";
    public string? PropertyId { get; set; }
    public string? PoNumber { get; set; }
    public string? InspectionDate { get; set; }
    public string? InspectionTime { get; set; }
    public string Status { get; set; } = "";
    public int RequiredPhotoSlots { get; set; }
    public int CompletedPhotoSlots { get; set; }
    public int PendingPhotoApprovals { get; set; }
    public int ObservationCount { get; set; }
    public int AttachmentCount { get; set; }
    public string? SubmittedAtUtc { get; set; }
    public string UpdatedAtUtc { get; set; } = "";
}

public class FieldInspectionWorkspaceSummaryDto
{
    public int Total { get; set; }
    public int Draft { get; set; }
    public int Reopened { get; set; }
    public int Submitted { get; set; }
    public int PhotosPendingApproval { get; set; }
    public int IncompleteRequiredPhotos { get; set; }
}
