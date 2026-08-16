namespace RealEstateEval.Domain;

public class CaseStudyForm
{
    public Guid Id { get; set; }
    public Guid TaskId { get; set; }
    public bool IsPartyForm { get; set; }
    public Guid? PropertyId { get; set; }
    public string? PoNumber { get; set; }
    public string Status { get; set; } = CaseStudyFormStatuses.New;
    public int CurrentStep { get; set; }
    public string RequestNumber { get; set; } = "";
    public string RequestDate { get; set; } = "";
    public string DeedNumber { get; set; } = "";
    /// <summary>JSON — answers map.</summary>
    public string AnswersJson { get; set; } = "{}";
    /// <summary>
    /// JSON — per-answer / per-remark provenance map keyed by question or remark id.
    /// </summary>
    public string? AnswerProvenanceJson { get; set; }
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
    public string? SpecialistReviewApprovedJson { get; set; }
    /// <summary>Is the asset linked to other assets? — empty | yes | no</summary>
    public string InfathLinkedAssets { get; set; } = "";
    public string InfathLinkedDeedNumbers { get; set; } = "";
    public string InfathLinkedAssetsNotes { get; set; } = "";
    public string InfathOtherNotes { get; set; } = "";
    public string InfathClosingNotes { get; set; } = "";
    /// <summary>matched | differences | impediment | "" — traditional-deed quality gate.</summary>
    public string DeedNatureMatchOutcome { get; set; } = "";
    public string DeedNatureMatchNotes { get; set; } = "";
    public DateTime? SavedAtUtc { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
}