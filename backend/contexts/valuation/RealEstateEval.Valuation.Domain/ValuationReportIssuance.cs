namespace RealEstateEval.Valuation.Domain;

/// <summary>
/// ق-6: الإصدار ثنائي المرحلة + شهادة الإيداع (بصيغة سليمان):
/// 1) عند اكتمال الحواجب يُجمَّد التقرير كاملاً وتُولَّد «نسخة الإيداع» (PDF وخانة رمز
///    الإيداع فارغة) — تُرفَع يدوياً في قيمة (قرار 17).
/// 2) منصة قيمة تصدر «شهادة الإيداع» وبها رمزها الخاص.
/// 3) الموظف يرفع الشهادة ويُدخل رمزها في الحقل القائم (report.deposit_code).
/// 4) «النسخة النهائية»: نفس التقرير المجمّد حرفياً + صفحة شهادة الإيداع صفحةً مرفقة
///    + الرمز في ميتا الصفحات. الرمز والشهادة وحدهما خارج نطاق التجميد.
/// النسختان تُحفظان في ملف المعاملة: المودعة (مطابق ما في المنصة) والنهائية (المتداولة).
/// </summary>
public class ValuationReportIssuance
{
    public Guid Id { get; set; }
    public Guid ValuationRequestId { get; set; }

 /// <summary>لحظة التجميد وإصدار نسخة الإيداع.</summary>
    public DateTime DepositIssuedAtUtc { get; set; }
    public string? DepositIssuedByUserId { get; set; }

 /// <summary>اللقطة المجمّدة لكامل التقرير (ValuationReportDocumentDto) — مصدر النسختين.</summary>
    public string DocumentJson { get; set; } = "";

 /// <summary>نسخة الإيداع — خانة رمز الإيداع فارغة.</summary>
    public byte[] DepositPdf { get; set; } = [];

 /// <summary>رمز شهادة الإيداع من منصة قيمة — خارج نطاق التجميد.</summary>
    public string? DepositCode { get; set; }
    public string? CertificateFileName { get; set; }
    public string? CertificateContentType { get; set; }
 /// <summary>شهادة الإيداع — تُحفظ مستنداً في ملف المعاملة وتدخل النسخة النهائية صفحةً.</summary>
    public byte[]? CertificateContent { get; set; }
    public DateTime? CertificateUploadedAtUtc { get; set; }
    public string? CertificateUploadedByUserId { get; set; }

 /// <summary>النسخة النهائية المتداولة — التقرير المجمّد + صفحة الشهادة + الرمز.</summary>
    public DateTime? FinalIssuedAtUtc { get; set; }
    public byte[]? FinalPdf { get; set; }

 /* ─── تكميلية ق-9 (ر2): نسخ الإيداع N+1 — الساري هو غير المُلغى، والملغى يبقى بالملف ─── */

 /// <summary>رقم دور التقييم — يبدأ من 1 ويرتفع مع كل إعادة فتح (ر2).</summary>
    public int Version { get; set; } = 1;

 /// <summary>لحظة الإلغاء «حلّت محلها نسخة أحدث» — null تعني النسخة السارية.</summary>
    public DateTime? SupersededAtUtc { get; set; }
    public string? SupersededByUserId { get; set; }
 /// <summary>سبب إعادة الفتح — إلزامي بحد ق-8-2 (١٠ أحرف).</summary>
    public string? SupersededReason { get; set; }

 /// <summary>
 /// ر2: إلغاء النسخة (لا حذف صلب) — النسخة المودعة لا تُعدَّل، وتُعلَّم
 /// «ملغاة — حلّت محلها نسخة أحدث» ويبقى ملفها في المعاملة.
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

    /* ─── B2: انتقالات ق-6 داخل الجذر — الخدمة تجهّز اللقطة والمولّدات وتُنسّق فقط ─── */

 /// <summary>ق-6-1: التجميد وإصدار نسخة الإيداع — نسخة سارية واحدة لكل طلب (ر2: الدور N+1).</summary>
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
 /// ق-6-3: تسجيل الشهادة والرمز — خارج نطاق التجميد؛ إعادة التسجيل تصحيحاً مسموحة.
 /// يعيد رسالة رفض عند رمز فارغ.
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

 /// <summary>ق-6-4: النسخة النهائية لا تصدر قبل تسجيل الرمز.</summary>
    public string? IssueFinal(byte[] finalPdf, DateTime nowUtc)
    {
        if (string.IsNullOrWhiteSpace(DepositCode))
            return "سجّل رمز الإيداع أولاً (ق-6-3)";

        FinalPdf = finalPdf;
        FinalIssuedAtUtc = nowUtc;
        return null;
    }
}

/// <summary>مراحل ق-6 كما تُعرض للواجهة.</summary>
public static class ReportIssuanceStages
{
 /// <summary>لم تصدر نسخة الإيداع بعد — التحرير مفتوح والحواجب تتحكم.</summary>
    public const string Draft = "draft";

 /// <summary>صدرت نسخة الإيداع — التقرير مجمّد بانتظار الشهادة والرمز.</summary>
    public const string DepositIssued = "deposit_issued";

 /// <summary>سُجِّلت الشهادة والرمز وصدرت النسخة النهائية.</summary>
    public const string FinalIssued = "final_issued";
}
