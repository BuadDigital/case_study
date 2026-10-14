namespace RealEstateEval.CaseStudy.Application.Contracts;

public class CaseStudyReportDto
{
    public string TaskId { get; set; } = "";
    public string? PropertyId { get; set; }
    public string? PoNumber { get; set; }
    public string Status { get; set; } = "new";
    public int CurrentStep { get; set; }
    public string RequestNumber { get; set; } = "";
    public string RequestDate { get; set; } = "";
    public string DeedNumber { get; set; } = "";
    public Dictionary<string, object?> Answers { get; set; } = new();
 /// <summary>Per-answer / remark provenance (server-authored; client may ignore on write).</summary>
    public Dictionary<string, AnswerProvenanceEntryDto>? AnswerProvenance { get; set; }
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
 /// <summary>matched | differences | impediment | "" — calc/issuance gate for traditional deeds.</summary>
    public string DeedNatureMatchOutcome { get; set; } = "";
    public string DeedNatureMatchNotes { get; set; } = "";
    public string? SavedAtUtc { get; set; }
}

public class SaveCaseStudyReportRequest
{
    public CaseStudyReportDto Report { get; set; } = new();
}

/// <summary>
/// <c>POST /api/case-study-reports/{taskId}/issue</c>: the specialist's FINAL report state. The
/// answers it carries are what the 100% completeness rule judges (not the stored row).
/// </summary>
public class IssueCaseStudyReportRequest
{
    public CaseStudyReportDto Report { get; set; } = new();
}

/// <summary><c>POST /api/case-study-reports/{taskId}/reopen</c>.</summary>
public class ReopenCaseStudyReportRequest
{
 /// <summary>Why the issued report is reopened — required, trimmed, at least 10 characters.</summary>
    public string Reason { get; set; } = "";

 /// <summary>
 /// Confirms clearing the Enfaz handover stamp when the property was already handed over;
 /// without it a handed-over transaction refuses to reopen.
 /// </summary>
    public bool ClearEnfazHandover { get; set; }
}

public class ReopenCaseStudyReportResultDto
{
    public CaseStudyReportDto Report { get; set; } = new();

 /// <summary>
 /// The appraiser had already submitted the appraisal package. The package is NOT touched —
 /// the appraiser is notified and the specialist decides what to reopen.
 /// </summary>
    public bool AppraiserSubmitted { get; set; }

 /// <summary>The Enfaz handover stamp was cleared by this reopening.</summary>
    public bool EnfazHandoverCleared { get; set; }
}
