namespace RealEstateEval.Application.Contracts;

/// <summary>
/// Immutable-per-change attribution for a case-study answer or section remark.
/// Keys in the map are question ids (e.g. <c>deed_2</c>) or remark keys
/// (<c>__deedRemarks</c>, <c>__surveyRemarks</c>, …).
/// </summary>
public class AnswerProvenanceEntryDto
{
    /// <summary>Answer value or remark text at the time of attribution.</summary>
    public string? Value { get; set; }

    /// <summary>Information-matrix party id when known (insp, eng, val, gov, …).</summary>
    public string? SourcePartyId { get; set; }

    /// <summary>Prototype / assignee role that produced the answer.</summary>
    public string? SourceRole { get; set; }

    /// <summary>Matrix role snapshot: primary | secondary | verify.</summary>
    public string? MatrixRole { get; set; }

    public string WorkflowTaskId { get; set; } = "";

    /// <summary>Case-study form id when available.</summary>
    public string? FormId { get; set; }

    public string? AnsweredByUserId { get; set; }

    public string? AnsweredByName { get; set; }

    public string AnsweredAtUtc { get; set; } = "";
}

/// <summary>Actor identity stamped by the API from JWT claims — never trust client bodies.</summary>
public class CaseStudyFormActor
{
    public string UserId { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public string? PrototypeRole { get; set; }
    public string? DistributionAssigneeId { get; set; }
}

/// <summary>Actor context for party submission mutations.</summary>
public class PartySubmissionActor
{
    public string UserId { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public string? PrototypeRole { get; set; }
    public string? DistributionAssigneeId { get; set; }
}
