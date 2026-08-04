using System.Text.Json;

namespace RealEstateEval.Application.Contracts;

public class PartyTaskSubmissionDto
{
    public string Id { get; set; } = "";
    public string TaskId { get; set; } = "";
    public string Kind { get; set; } = "";
    public string Status { get; set; } = "draft";
    public string? PropertyId { get; set; }
    public string? PoNumber { get; set; }
    public JsonElement Payload { get; set; }
    public string? ReturnNote { get; set; }
    public string? SubmittedAtUtc { get; set; }
    public string? AcceptedAtUtc { get; set; }
    public string? SubmittedByUserId { get; set; }
    public string? SubmittedByName { get; set; }
    public string? AcceptedByUserId { get; set; }
    public string? AcceptedByName { get; set; }
    public string? ReopenedByUserId { get; set; }
    public string? ReopenedByName { get; set; }
    public string UpdatedAtUtc { get; set; } = "";

    /// <summary>
    /// Engineering-survey only: sibling field-inspection is completed (authoritative for EO unlock).
    /// Also exposed on WorkflowTaskDto list items. Null for other submission kinds.
    /// </summary>
    public bool? FieldInspectionCompleted { get; set; }
}

public class SavePartyTaskSubmissionRequest
{
    public JsonElement Payload { get; set; }
}

public class ReopenPartyTaskSubmissionRequest
{
    public string ReturnNote { get; set; } = "";
}
