// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 2 (1b19bedc)
//  • Gates New file — the specialist cannot send the report draft while a required document he uploads
//          is missing (gate required_attachments: «صك الملكية», «التقرير المساحي» …); the refusal names them.
// ──────────────────────────────────────────────────────────────────────────────────────────────

using RealEstateEval.Valuation.Application.Contracts;
using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Valuation.Application.Rules;

/// <summary>
/// Round 2: the specialist cannot send the valuation-report draft while a required report document
/// that only he uploads is missing (the issuance gate <c>required_attachments</c> — «صك الملكية»,
/// «التقرير المساحي» …). The appraiser's approval issues the deposit copy through the same gate, so a
/// draft sent without them could only be refused for something the appraiser cannot fix.
/// </summary>
public static class ReportDraftSendRules
{
    public const string ErrorKey = "requiredAttachments";

    public const string MissingDocumentsPrefixAr =
        "لا تُرسَل المسودة للمقيّم قبل رفع المستندات الإلزامية التي يرفعها الأخصائي — ";

    public const string DeedMatchErrorKey = "deedNatureMatch";

    public const string DeedMatchPrefixAr =
        "لا تُرسَل المسودة للمقيّم قبل حسم مطابقة الصك للطبيعة في تقرير دراسة الحالة — ";

    /// <summary>
    /// The send refusal while the deed/nature match blocks the issue — the appraiser's approval is refused
    /// for it, and only the specialist can change it (A→Z 2026-11-04 #18: a study re-issued with «فروق»
    /// still let the draft go to the appraiser). Null when the gate passes or there are no gates.
    /// </summary>
    public static Dictionary<string, string>? DeedNatureMatchError(ValuationIssuanceGatesDto? gates)
    {
        var gate = gates?.Gates.FirstOrDefault(g =>
            g.IsHard
            && !g.Passed
            && string.Equals(g.Code, ValuationIssuanceGateCodes.DeedNatureMatch, StringComparison.OrdinalIgnoreCase));
        if (gate is null) return null;
        var detail = string.IsNullOrWhiteSpace(gate.DetailAr) ? gate.LabelAr : gate.DetailAr.Trim();
        return new Dictionary<string, string> { [DeedMatchErrorKey] = DeedMatchPrefixAr + detail };
    }

    public const string StudyReportErrorKey = "studyReport";

    public const string StudyReportNotIssuedAr =
        "سلّم الدفعة كاملة: أصدر تقرير دراسة الحالة أولًا ثم سلّمه مع المسودة للمراجعة";

    /// <summary>
    /// The handover refusal while the study report is not issued (Omar 2026-11-05: review receives the
    /// study report and the valuation draft in one batch). Null when the gate passes or there are no gates.
    /// </summary>
    /// <remarks>
    /// Edge cases + fixed 2026-11-10: when the gate failed because Case Study could not be read, the
    /// refusal says so («تعذّر التحقق … حاول مرة أخرى») instead of «أصدر تقرير دراسة الحالة».
    /// </remarks>
    public static Dictionary<string, string>? StudyReportNotIssuedError(ValuationIssuanceGatesDto? gates)
    {
        var gate = gates?.Gates.FirstOrDefault(g =>
            !g.Passed
            && string.Equals(g.Code, ValuationIssuanceGateCodes.StudyReportIssued, StringComparison.OrdinalIgnoreCase));
        if (gate is null) return null;
        var unknown = string.Equals(
            gate.DetailAr, ValuationIssuanceGateRules.CaseStudyStateUnavailableAr, StringComparison.Ordinal);
        return new Dictionary<string, string>
        {
            [StudyReportErrorKey] = unknown ? ValuationIssuanceGateRules.CaseStudyStateUnavailableAr : StudyReportNotIssuedAr,
        };
    }

    public const string ReviewErrorKey = "review";
    public const string StudyNotApprovedAr = "اعتمد الدراسة أولاً — تُصدَر المسودة للمقيّم بعد اعتماد الدراسة وقبول القيمة";
    public const string ValueNotAcceptedAr = "اقبل القيمة التي سلّمها المقيّم أولاً — أو أرجعها له إن لاحظت خطأ";

    /// <summary>
    /// The send refusal while review has not approved the study or accepted the appraiser's value (Omar
    /// 2026-11-08: review approves the study, accepts the value, then issues the draft to the appraiser).
    /// </summary>
    /// <remarks>
    /// How it works: false → the matching refusal; null → «تعذّر التحقق من حالة دراسة الحالة — حاول مرة أخرى».
    /// Edge cases + fixed 2026-11-10: an unknown answer used to pass (the draft could reach the appraiser
    /// while Case Study was down). Case Study always answers both fields, so null now means it could not be
    /// read. Only a missing gate evaluation altogether (no gate service — tests) does not block; a legacy
    /// valuation without a case-study property never reaches the send (its package is never «submitted»).
    /// </remarks>
    public static Dictionary<string, string>? ReviewNotDoneError(ValuationIssuanceGatesDto? gates)
    {
        if (gates is null) return null;
        if (gates.StudyApprovedByReview is null || gates.ValueAcceptedByReview is null)
            return new Dictionary<string, string> { [ReviewErrorKey] = ValuationIssuanceGateRules.CaseStudyStateUnavailableAr };
        if (gates.StudyApprovedByReview == false)
            return new Dictionary<string, string> { [ReviewErrorKey] = StudyNotApprovedAr };
        if (gates.ValueAcceptedByReview == false)
            return new Dictionary<string, string> { [ReviewErrorKey] = ValueNotAcceptedAr };
        return null;
    }

    /// <summary>The send refusal naming every missing document, or null when none is missing (or no gates).</summary>
    public static Dictionary<string, string>? MissingSpecialistDocumentsError(ValuationIssuanceGatesDto? gates)
    {
        var gate = gates?.Gates.FirstOrDefault(g =>
            g.IsHard
            && !g.Passed
            && string.Equals(g.Code, ValuationIssuanceGateCodes.RequiredAttachments, StringComparison.OrdinalIgnoreCase));
        if (gate is null) return null;
        var detail = string.IsNullOrWhiteSpace(gate.DetailAr) ? gate.LabelAr : gate.DetailAr.Trim();
        return new Dictionary<string, string> { [ErrorKey] = MissingDocumentsPrefixAr + detail };
    }
}
