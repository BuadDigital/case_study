using System.Text.Json;

namespace RealEstateEval.Application.Contracts;

public class PartyTaskSubmissionDto
{
    public string TaskId { get; set; } = "";
    public string Kind { get; set; } = "";
    public string Status { get; set; } = "draft";
    public string? PropertyId { get; set; }
    public string? PoNumber { get; set; }
    public JsonElement Payload { get; set; }
    public string? ReturnNote { get; set; }
    public string? SubmittedAtUtc { get; set; }
    public string? AcceptedAtUtc { get; set; }
    public string UpdatedAtUtc { get; set; } = "";
}

public class SavePartyTaskSubmissionRequest
{
    public JsonElement Payload { get; set; }
}

public class ReopenPartyTaskSubmissionRequest
{
    public string ReturnNote { get; set; } = "";
}
