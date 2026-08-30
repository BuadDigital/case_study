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

 /// <summary>Deposit copy — deposit-code field empty.</summary>
    public byte[] DepositPdf { get; set; } = [];

 /// <summary>Deposit-certificate code from Qiama — outside freeze scope.</summary>
    public string? DepositCode { get; set; }
    public string? CertificateFileName { get; set; }
    public string? CertificateContentType { get; set; }
 /// <summary>Deposit certificate — stored on the transaction file and appended as a page in the final copy.</summary>
    public byte[]? CertificateContent { get; set; }
    public DateTime? CertificateUploadedAtUtc { get; set; }
    public string? CertificateUploadedByUserId { get; set; }

 /// <summary>Circulated final copy — frozen report + certificate page + code.</summary>
    public DateTime? FinalIssuedAtUtc { get; set; }
    public byte[]? FinalPdf { get; set; }

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
        byte[] depositPdf,
        string? issuedByUserId,
        DateTime nowUtc,
        int version = 1) => new()
        {
            Id = Guid.NewGuid(),
            ValuationRequestId = valuationRequestId,
            DepositIssuedAtUtc = nowUtc,
            DepositIssuedByUserId = issuedByUserId,
            DocumentJson = documentJson,
            DepositPdf = depositPdf,
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
        byte[]? certificateContent,
        string? uploadedByUserId,
        DateTime nowUtc)
    {
        var code = depositCode.Trim();
        if (code.Length == 0)
            return "رمز الإيداع مطلوب";

        DepositCode = code;
        CertificateFileName = certificateFileName?.Trim();
        CertificateContentType = certificateContentType?.Trim();
        if (certificateContent is not null)
            CertificateContent = certificateContent;
        CertificateUploadedAtUtc = nowUtc;
        CertificateUploadedByUserId = uploadedByUserId;
        return null;
    }

 /// <summary>Q-6-4: final copy is not issued before the code is registered.</summary>
    public string? IssueFinal(byte[] finalPdf, DateTime nowUtc)
    {
        if (string.IsNullOrWhiteSpace(DepositCode))
            return "سجّل رمز الإيداع أولاً (ق-6-3)";

        FinalPdf = finalPdf;
        FinalIssuedAtUtc = nowUtc;
        return null;
    }
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
