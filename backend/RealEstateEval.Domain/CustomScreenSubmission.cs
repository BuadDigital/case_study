namespace RealEstateEval.Domain;

/// <summary>User answers for a CDO-built dynamic custom screen.</summary>
public class CustomScreenSubmission
{
    public Guid Id { get; set; }
    public Guid ScreenId { get; set; }
    public CustomAssignedScreen Screen { get; set; } = null!;
    public string UserId { get; set; } = "";
    public string AnswersJson { get; set; } = "{}";
    public bool IsDraft { get; set; } = true;
    public DateTime UpdatedAtUtc { get; set; }
    public DateTime? SubmittedAtUtc { get; set; }
}
