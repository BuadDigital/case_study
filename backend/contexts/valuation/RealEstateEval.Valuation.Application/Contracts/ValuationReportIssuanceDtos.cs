using System.ComponentModel.DataAnnotations;

namespace RealEstateEval.Valuation.Application.Contracts;

/// <summary>ق-6: حالة الإصدار ثنائي المرحلة للواجهة.</summary>
public class ValuationReportIssuanceStateDto
{
    public Guid ValuationRequestId { get; init; }

 /// <summary>draft | deposit_issued | final_issued.</summary>
    public string Stage { get; init; } = "draft";

 /// <summary>الحواجب مكتملة والمرحلة مسودة — زر «إصدار نسخة الإيداع» مفعّل.</summary>
    public bool AllowsDepositIssue { get; init; }
    public IReadOnlyList<string> BlockingReasonsAr { get; init; } = [];

    public string? DepositIssuedAtUtc { get; init; }
    public string? DepositCode { get; init; }
    public string? CertificateFileName { get; init; }
    public string? CertificateUploadedAtUtc { get; init; }
    public string? FinalIssuedAtUtc { get; init; }
    public bool HasDepositPdf { get; init; }
    public bool HasFinalPdf { get; init; }

 /// <summary>تكميلية ق-9 (ر2): رقم دور التقييم الساري — 1 قبل أي إعادة فتح.</summary>
    public int Version { get; init; } = 1;

 /// <summary>عدد النسخ الملغاة «حلّت محلها نسخة أحدث» الباقية في ملف المعاملة.</summary>
    public int SupersededCount { get; init; }
}

/// <summary>
/// تكميلية ق-9 (ر2): إعادة فتح دور التقييم بعد الإيداع — بموافقة مشرف القسم؛
/// السبب إلزامي بحد ق-8-2 (١٠ أحرف).
/// </summary>
public class ReopenReportIssuanceRequest
{
    [Required, MaxLength(1024)]
    public string Reason { get; init; } = "";
}

/// <summary>
/// ق-6-3: تسجيل شهادة الإيداع ورمزها — الخطوة تولّد النسخة النهائية (ق-6-4).
/// الشهادة صورة يفضَّل (تدخل صفحةً)؛ الصيغ الأخرى تُحفظ ويُشار إليها.
/// </summary>
public class RegisterDepositCertificateRequest
{
    [Required, MaxLength(128)]
    public string DepositCode { get; init; } = "";

    [MaxLength(512)]
    public string? CertificateFileName { get; init; }

    [MaxLength(128)]
    public string? CertificateContentType { get; init; }

 /// <summary>محتوى الشهادة Base64 — اختياري (يمكن الاكتفاء بالرمز ثم استكمال الشهادة).</summary>
    public string? CertificateContentBase64 { get; init; }
}
