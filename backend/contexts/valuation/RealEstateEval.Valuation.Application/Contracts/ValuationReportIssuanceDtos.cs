// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 2 (1b19bedc)
//  • DepositCode: Arabic messages for the required and max-length (128) checks.
// ──────────────────────────────────────────────────────────────────────────────────────────────

using System.ComponentModel.DataAnnotations;

namespace RealEstateEval.Valuation.Application.Contracts;

/// <summary>two-phase issuance status for the UI.</summary>
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

 /// <summary>none | preparing | ready — the generated final PDF (report + deposit code + certificate page).</summary>
    public string FinalReportStatus { get; init; } = "none";

 /// <summary>Supplement: current valuation cycle number — 1 before any reopen.</summary>
    public int Version { get; init; } = 1;

 /// <summary>Count of superseded copies ("replaced by a newer copy") remaining on the transaction file.</summary>
    public int SupersededCount { get; init; }
}

/// <summary>
/// Supplement: reopen the valuation cycle after deposit — requires section-supervisor approval;
/// reason required with minimum (10 characters).
/// </summary>
public class ReopenReportIssuanceRequest
{
    [Required, MaxLength(1024)]
    public string Reason { get; init; } = "";
}

/// <summary>
/// Register deposit certificate and its code — this step generates the final copy.
/// Certificate image preferred (becomes a page); other formats are stored and referenced.
/// </summary>
public class RegisterDepositCertificateRequest
{
    [Required(ErrorMessage = "رمز الإيداع مطلوب")]
    [MaxLength(128, ErrorMessage = "رمز الإيداع طويل جدًا — الحد الأقصى 128 حرفاً")]
    public string DepositCode { get; init; } = "";

    [MaxLength(512)]
    public string? CertificateFileName { get; init; }

    [MaxLength(128)]
    public string? CertificateContentType { get; init; }

 /// <summary>Certificate content Base64 — optional (code alone is enough; certificate can be completed later).</summary>
    public string? CertificateContentBase64 { get; init; }
}
