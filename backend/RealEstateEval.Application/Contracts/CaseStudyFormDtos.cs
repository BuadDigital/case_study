namespace RealEstateEval.Application.Contracts;

public class CaseStudyFormDto
{
    public int Version { get; set; } = 1;
    public string TaskId { get; set; } = "";
    public string? PropertyId { get; set; }
    public string? PoNumber { get; set; }
    public string Status { get; set; } = "new";
    public int CurrentStep { get; set; }
    public string RequestNumber { get; set; } = "";
    public string RequestDate { get; set; } = "";
    public string DeedNumber { get; set; } = "";
    public Dictionary<string, object?> Answers { get; set; } = new();
    public string DeedRemarks { get; set; } = "";
    public string SurveyRemarks { get; set; } = "";
    public string ComponentsRemarks { get; set; } = "";
    public string OccupancyRemarks { get; set; } = "";
    public string MeterType { get; set; } = "";
    public string MeterNumber { get; set; } = "";
    public string HoaFee { get; set; } = "";
    public string SigDeed { get; set; } = "";
    public string SigApprover { get; set; } = "";
    public string SigDate { get; set; } = "";
    public Dictionary<string, bool>? SpecialistReviewApproved { get; set; }
    public string InfathLinkedAssets { get; set; } = "";
    public string InfathLinkedDeedNumbers { get; set; } = "";
    public string InfathLinkedAssetsNotes { get; set; } = "";
    public string InfathOtherNotes { get; set; } = "";
    public string InfathClosingNotes { get; set; } = "";
    public string? SavedAtUtc { get; set; }
}

public class SaveCaseStudyFormRequest
{
    public CaseStudyFormDto Form { get; set; } = new();
}
