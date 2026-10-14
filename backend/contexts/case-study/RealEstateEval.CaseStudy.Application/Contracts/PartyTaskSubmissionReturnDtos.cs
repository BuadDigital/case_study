namespace RealEstateEval.CaseStudy.Application.Contracts;

/// <summary>One section of the inspector's package the specialist sends back (key + Arabic label).</summary>
public sealed class ReturnImpactSectionDto
{
    public string Key { get; set; } = "";
    public string LabelAr { get; set; } = "";
}

/// <summary>A sibling party the return of the inspection may affect.</summary>
public sealed class ReturnImpactPartyDto
{
    public string TaskId { get; set; } = "";

    /// <summary><c>property-appraisal</c> | <c>engineering-survey</c>.</summary>
    public string Kind { get; set; } = "";

    public string? AssigneeName { get; set; }

    /// <summary><c>none</c> | <c>draft</c> | <c>submitted</c> | <c>reopened</c>.</summary>
    public string PackageStatus { get; set; } = "none";

    /// <summary>The fixed section→party map suggests this party for the requested sections.</summary>
    public bool Suggested { get; set; }

    /// <summary>Labels of the requested sections that suggest this party.</summary>
    public List<string> SuggestedBecause { get; set; } = [];

    /// <summary><c>reopen</c> (submitted package returns to the party) | <c>notify</c> (a notice only).</summary>
    public string WillBe { get; set; } = "notify";
}

public sealed class ReturnImpactDto
{
    public List<ReturnImpactSectionDto> Sections { get; set; } = [];
    public List<ReturnImpactPartyDto> Parties { get; set; } = [];

    /// <summary>The parent's case-study report is issued — the specialist must choose keep / reopen.</summary>
    public bool StudyReportIssued { get; set; }

    /// <summary>The appraiser submitted and the valuation request is closed (deposited): never reopened.</summary>
    public bool ValuationClosed { get; set; }
}

public sealed class ReturnInspectionRequest
{
    public string ReturnNote { get; set; } = "";
    public List<string> Sections { get; set; } = [];
    public List<string> AffectedTaskIds { get; set; } = [];

    /// <summary><c>keep</c> | <c>reopen</c> | null. Required when the study report is issued.</summary>
    public string? StudyReport { get; set; }

    public string? StudyReportReopenReason { get; set; }
}

public sealed class ReturnInspectionPartyOutcomeDto
{
    public string TaskId { get; set; } = "";
    public string Kind { get; set; } = "";

    /// <summary><c>reopened</c> | <c>notified</c> | <c>already</c> | <c>skipped_deposited</c> | <c>skipped_no_assignee</c>.</summary>
    public string Outcome { get; set; } = "";
}

public sealed class ReturnInspectionStudyReportDto
{
    public bool Issued { get; set; }
    public bool Reopened { get; set; }
}

public sealed class ReturnInspectionResultDto
{
    public PartyTaskSubmissionDto Inspection { get; set; } = new();
    public List<ReturnInspectionPartyOutcomeDto> Parties { get; set; } = [];
    public ReturnInspectionStudyReportDto StudyReport { get; set; } = new();
}
