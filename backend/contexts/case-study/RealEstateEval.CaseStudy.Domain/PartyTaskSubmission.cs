namespace RealEstateEval.CaseStudy.Domain;

/// <summary>Party work submission for child workflow tasks (survey, appraisal, review, etc.).</summary>
public class PartyTaskSubmission
{
    public Guid Id { get; set; }
    public Guid WorkflowTaskId { get; set; }
    public string Kind { get; set; } = "";
    public string Status { get; set; } = "draft";
    public Guid? PropertyId { get; set; }
    public string? PoNumber { get; set; }
 /// <summary>JSON payload matching frontend submission types per kind.</summary>
    public string PayloadJson { get; set; } = "{}";
    public string? ReturnNote { get; set; }
    public DateTime? SubmittedAtUtc { get; set; }
 /// <summary>
 /// Set when a specialist accepts party outputs (survey fee accrual; inspection → إنفاذ package gate).
 /// </summary>
    public DateTime? AcceptedAtUtc { get; set; }
    public string? SubmittedByUserId { get; set; }
    public string? SubmittedByName { get; set; }
    public string? AcceptedByUserId { get; set; }
    public string? AcceptedByName { get; set; }
    public string? ReopenedByUserId { get; set; }
    public string? ReopenedByName { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
}
