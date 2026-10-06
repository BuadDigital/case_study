using System.ComponentModel.DataAnnotations;
using System.Text.Json;

namespace RealEstateEval.Valuation.Application.Contracts;

/// <summary>
/// The valuation-report draft of a request as the specialist and the appraiser read it. An absent
/// draft (the appraiser has not handed over yet, or the specialist has not started) reads as
/// <see cref="Status"/> <c>none</c> with <see cref="PackageStatus"/> telling why.
/// </summary>
public class ValuationReportDraftDto
{
    public Guid ValuationRequestId { get; init; }
    public Guid? DraftId { get; init; }

    /// <summary>none | preparing | sent | approved.</summary>
    public string Status { get; init; } = "none";

    /// <summary>Report cycle (1 until a deposited report is reopened as a new version).</summary>
    public int Version { get; init; } = 1;

    /// <summary>The appraiser's package: none | draft | submitted | reopened | unknown (Case Study unreachable).</summary>
    public string PackageStatus { get; init; } = "unknown";

    /// <summary>The specialist may prepare the draft now (package submitted, nothing deposited).</summary>
    public bool CanPrepare { get; init; }

    /// <summary>The specialist's report choices (allow-listed JSON object): they overlay the appraiser's own.</summary>
    public JsonElement? SpecialistChoices { get; init; }

    public string? SpecialistNote { get; init; }
    public string? AppraiserNote { get; init; }
    public string? ConformityConfirmedAtUtc { get; init; }
    public string? SentAtUtc { get; init; }
    public string? ApprovedAtUtc { get; init; }
    public string? ReportDate { get; init; }

    public bool HasSnapshot { get; init; }
    public string? SnapshotSha256 { get; init; }
    public string UpdatedAtUtc { get; init; } = "";

    /// <summary>Where the report copy stands: draft | deposit_issued (approved, waiting for the code) | final_issued.</summary>
    public string ReportStage { get; init; } = "draft";

    /// <summary>The Qeema deposit code recorded for this cycle (editable after the final issuance).</summary>
    public string? DepositCode { get; init; }
    public string? CertificateFileName { get; init; }
    public string? FinalIssuedAtUtc { get; init; }

    /// <summary>none | preparing | ready — the generated final PDF (report + deposit code + certificate page).</summary>
    public string FinalReportStatus { get; init; } = "none";
}

/// <summary>One property's draft state for queue labels: where the draft and the report copy stand (no content).</summary>
public class ReportDraftStateDto
{
    public Guid PropertyId { get; init; }

    /// <summary>none | preparing | sent | approved.</summary>
    public string Status { get; init; } = "none";

    /// <summary>draft | deposit_issued | final_issued.</summary>
    public string ReportStage { get; init; } = "draft";

    /// <summary>
    /// The appraiser's progress ladder (0–100) from his real work and the report cycle, except that «handed over
    /// to the specialist» (75) is known to Case Study only — the reader raises it from the task's package status.
    /// </summary>
    public int ProgressPct { get; init; }
}

/// <summary>Where the generated final PDF stands after a (re)generation attempt.</summary>
public class FinalReportStatusDto
{
    /// <summary>none | preparing | ready.</summary>
    public string FinalReportStatus { get; init; } = "none";
}

/// <summary>The specialist saves his report choices (only while the draft is being prepared).</summary>
public class SaveReportDraftChoicesRequest
{
    /// <summary>A JSON object with allow-listed keys only (ESG, print attachments…).</summary>
    [Required]
    public JsonElement Choices { get; init; }
}

/// <summary>The specialist sends the draft to the appraiser, confirming it matches the property study.</summary>
public class SendReportDraftRequest
{
    /// <summary>«أؤكد أن التقييم مطابق لدراسة العقار» — required.</summary>
    public bool ConformityConfirmed { get; init; }

    [MaxLength(2000)]
    public string? Note { get; init; }
}

/// <summary>A note travelling with a withdrawal (the specialist pulling a sent draft, the appraiser his approval).</summary>
public class WithdrawReportDraftRequest
{
    [MaxLength(2000)]
    public string? Note { get; init; }
}

/// <summary>The appraiser approves the sent draft: the printed report as he saw it, and the report date.</summary>
public class ApproveReportDraftRequest
{
    /// <summary>The report date printed on the report (yyyy-MM-dd).</summary>
    [Required, MaxLength(10)]
    public string ReportDate { get; init; } = "";

    /// <summary>The approved printed report — the browser's print HTML.</summary>
    [Required]
    public string Html { get; init; } = "";
}

/// <summary>Who is acting on the draft — resolved from the caller's permissions by the controller.</summary>
public class ReportDraftActor
{
    public required string UserId { get; init; }
    public string? DisplayName { get; init; }
    public string? PrototypeRole { get; init; }
    public string? DistributionAssigneeId { get; init; }
}
