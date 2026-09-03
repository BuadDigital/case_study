using System.ComponentModel.DataAnnotations;

namespace RealEstateEval.Valuation.Application.Contracts;

/// <summary>Q-6: two-phase issuance status for the UI.</summary>
public class ValuationReportIssuanceStateDto
{
    public Guid ValuationRequestId { get; init; }

 /// <summary>draft | deposit_issued | final_issued.</summary>
    public string Stage { get; init; } = "draft";

 /// <summary>Gates complete and phase is draft — "Issue deposit copy" button enabled.</summary>
    public bool AllowsDepositIssue { get; init; }
    public IReadOnlyList<string> BlockingReasonsAr { get; init; } = [];

    public string? DepositIssuedAtUtc { get; init; }
    public string? DepositCode { get; init; }
    public string? CertificateFileName { get; init; }
    public string? CertificateUploadedAtUtc { get; init; }
    public string? FinalIssuedAtUtc { get; init; }
    public bool HasDepositPdf { get; init; }
    public bool HasFinalPdf { get; init; }

 /// <summary>Q-9 supplement (R2): current valuation cycle number — 1 before any reopen.</summary>
    public int Version { get; init; } = 1;

 /// <summary>Count of superseded copies ("replaced by a newer copy") remaining on the transaction file.</summary>
    public int SupersededCount { get; init; }
}

/// <summary>
/// Q-9 supplement (R2): reopen the valuation cycle after deposit — requires section-supervisor approval;
/// reason required with Q-8-2 minimum (10 characters).
/// </summary>
public class ReopenReportIssuanceRequest
{
    [Required, MaxLength(1024)]
    public string Reason { get; init; } = "";
}

/// <summary>
/// Q-6-3: register deposit certificate and its code — this step generates the final copy (Q-6-4).
/// Certificate image preferred (becomes a page); other formats are stored and referenced.
/// </summary>
public class RegisterDepositCertificateRequest
{
    [Required, MaxLength(128)]
    public string DepositCode { get; init; } = "";

    [MaxLength(512)]
    public string? CertificateFileName { get; init; }

    [MaxLength(128)]
    public string? CertificateContentType { get; init; }

 /// <summary>Certificate content Base64 — optional (code alone is enough; certificate can be completed later).</summary>
    public string? CertificateContentBase64 { get; init; }
}
