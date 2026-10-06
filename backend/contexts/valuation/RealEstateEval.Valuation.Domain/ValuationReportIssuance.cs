namespace RealEstateEval.Valuation.Domain;

/// <summary>
/// Q-6: two-phase issuance + deposit certificate (Sulaiman wording):
/// 1) When gates pass, the full report is frozen and a "deposit copy" is generated (PDF with deposit-code
///    field empty) — uploaded manually to Qiama (decision 17).
/// 2) Qiama platform issues a "deposit certificate" with its own code.
/// 3) Staff uploads the certificate and enters its code in the existing field (report.deposit_code).
/// 4) "Final copy": the frozen report literally + the deposit-certificate page as an attachment
///    + the code in page metadata. Only the code and certificate are outside the freeze scope.
/// Both copies are kept on the transaction file: deposited (matches the platform) and final (circulated).
/// </summary>
public class ValuationReportIssuance
{
    public Guid Id { get; set; }
    public Guid ValuationRequestId { get; set; }

 /// <summary>Freeze moment and deposit-copy issuance.</summary>
    public DateTime DepositIssuedAtUtc { get; set; }
    public string? DepositIssuedByUserId { get; set; }

 /// <summary>Frozen snapshot of the full report (ValuationReportDocumentDto) — source for both copies.</summary>
    public string DocumentJson { get; set; } = "";

 /// <summary>Deposit-certificate code from Qiama — outside freeze scope.</summary>
    public string? DepositCode { get; set; }
    public string? CertificateFileName { get; set; }
    public string? CertificateContentType { get; set; }
 /// <summary>The certificate in the attachments service — stored on the transaction file and appended as a page in the final copy.</summary>
    public Guid? CertificateAttachmentId { get; set; }
 /// <summary>Legacy: certificates recorded before they moved to the attachments service live here.</summary>
    public byte[]? CertificateContent { get; set; }
    public DateTime? CertificateUploadedAtUtc { get; set; }
    public string? CertificateUploadedByUserId { get; set; }

 /// <summary>Circulated final copy — frozen report + certificate page + code.</summary>
    public DateTime? FinalIssuedAtUtc { get; set; }

 /// <summary>The generated final PDF (report with the code + the certificate page) in the attachments service; null until generated.</summary>
    public Guid? FinalPdfAttachmentId { get; set; }
 /// <summary>The deposit code printed in the stored final PDF — a different current code means it must be regenerated.</summary>
    public string? FinalPdfDepositCode { get; set; }
    public DateTime? FinalPdfGeneratedAtUtc { get; set; }

 /// <summary>The certificate is on record (attachments service, or legacy inline bytes).</summary>
    public bool HasCertificate => CertificateAttachmentId is not null || CertificateContent is { Length: > 0 };

 /// <summary>The final PDF exists and carries the current deposit code.</summary>
    public bool FinalPdfIsCurrent =>
        FinalPdfAttachmentId is not null
        && string.Equals(FinalPdfDepositCode, DepositCode, StringComparison.Ordinal);

 /// <summary>none | preparing | ready — see <see cref="FinalReportStatuses"/>.</summary>
    public string FinalReportStatus =>
        FinalIssuedAtUtc is null
            ? FinalReportStatuses.None
            : FinalPdfIsCurrent ? FinalReportStatuses.Ready : FinalReportStatuses.Preparing;

 /// <summary>Records the freshly generated final PDF; the caller removes the replaced attachment.</summary>
    public void SetFinalPdf(Guid attachmentId, string depositCode, DateTime nowUtc)
    {
        FinalPdfAttachmentId = attachmentId;
        FinalPdfDepositCode = depositCode;
        FinalPdfGeneratedAtUtc = nowUtc;
    }

 /* ─── Q-9 supplement (R2): deposit copies N+1 — current = non-superseded; superseded stays on file ─── */

 /// <summary>Valuation cycle number — starts at 1 and increments on each reopen (R2).</summary>
    public int Version { get; set; } = 1;

 /// <summary>Supersession moment ("replaced by a newer copy") — null means the current copy.</summary>
    public DateTime? SupersededAtUtc { get; set; }
    public string? SupersededByUserId { get; set; }
 /// <summary>Reopen reason — required with Q-8-2 minimum (10 characters).</summary>
    public string? SupersededReason { get; set; }

 /// <summary>
 /// R2: supersede the copy (no hard delete) — the deposited copy is not edited; it is marked
 /// "superseded — replaced by a newer copy" and its file stays on the transaction.
 /// </summary>
    public string? Supersede(string? byUserId, string reason, DateTime nowUtc)
    {
        if (SupersededAtUtc is not null)
            return "هذه النسخة ملغاة سلفاً — حلّت محلها نسخة أحدث";
        if (!JustificationRules.IsAcceptable(reason))
            return JustificationRules.TooShortMessageAr("سبب إعادة الفتح");

        SupersededAtUtc = nowUtc;
        SupersededByUserId = byUserId;
        SupersededReason = reason.Trim();
        return null;
    }

    /* ─── B2: Q-6 transitions on the aggregate — service prepares snapshot/generators and coordinates only ─── */

 /// <summary>Q-6-1: freeze and issue deposit copy — one current copy per request (R2: cycle N+1).</summary>
    public static ValuationReportIssuance IssueDeposit(
        Guid valuationRequestId,
        string documentJson,
        string? issuedByUserId,
        DateTime nowUtc,
        int version = 1) => new()
        {
            Id = Guid.NewGuid(),
            ValuationRequestId = valuationRequestId,
            DepositIssuedAtUtc = nowUtc,
            DepositIssuedByUserId = issuedByUserId,
            DocumentJson = documentJson,
            Version = version,
        };

 /// <summary>
 /// Q-6-3: register certificate and code — outside freeze scope; corrective re-registration allowed.
 /// Returns a rejection message when the code is empty.
 /// </summary>
    public string? RegisterCertificate(
        string depositCode,
        string? certificateFileName,
        string? certificateContentType,
        Guid? certificateAttachmentId,
        byte[]? legacyCertificateContent,
        string? uploadedByUserId,
        DateTime nowUtc)
    {
        var code = depositCode.Trim();
        if (code.Length == 0)
            return "رمز الإيداع مطلوب";

        DepositCode = code;
        // A code-only correction keeps the certificate (and its name) already on the copy.
        if (certificateAttachmentId is not null || legacyCertificateContent is not null)
        {
            CertificateFileName = certificateFileName?.Trim();
            CertificateContentType = certificateContentType?.Trim();
            CertificateAttachmentId = certificateAttachmentId;
            CertificateContent = legacyCertificateContent;
        }
        CertificateUploadedAtUtc = nowUtc;
        CertificateUploadedByUserId = uploadedByUserId;
        return null;
    }

 /// <summary>Q-6-4: final copy is not issued before the code is registered.</summary>
    public string? IssueFinal(DateTime nowUtc)
    {
        if (string.IsNullOrWhiteSpace(DepositCode))
            return "سجّل رمز الإيداع أولاً (ق-6-3)";
        if (!HasCertificate)
            return "أرفق شهادة الإيداع (PDF)";

        FinalIssuedAtUtc = nowUtc;
        return null;
    }
}

/// <summary>Where the generated final PDF stands (the report with the deposit code + the certificate page).</summary>
public static class FinalReportStatuses
{
    /// <summary>The final copy is not issued yet.</summary>
    public const string None = "none";

    /// <summary>Issued, but the PDF is not generated yet (or the renderer failed) — can be retried.</summary>
    public const string Preparing = "preparing";

    /// <summary>The stored PDF carries the current deposit code.</summary>
    public const string Ready = "ready";
}

/// <summary>Q-6 phases as shown to the UI.</summary>
public static class ReportIssuanceStages
{
 /// <summary>Deposit copy not yet issued — editing is open; gates control issuance.</summary>
    public const string Draft = "draft";

 /// <summary>Deposit copy issued — report frozen pending certificate and code.</summary>
    public const string DepositIssued = "deposit_issued";

 /// <summary>Certificate and code registered; final copy issued.</summary>
    public const string FinalIssued = "final_issued";
}
