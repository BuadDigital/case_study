// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 2 (1b19bedc)
//  • B    New gate adjustment_rationales_<table> «مبررات التسويات والأوزان اليدوية»: a non-zero factor or
//         manual weight without a 10-character rationale blocks issue and hand-over, each item named.
//  • AttachmentScopeKeys — documents are also looked up under the survey task id, so the
//         engineering survey «التقرير المساحي» is found for vacant land.
// ──────────────────────────────────────────────────────────────────────────────────────────────

using RealEstateEval.Domain;

namespace RealEstateEval.Valuation.Domain;

/// <summary>Hard / soft issuance checks before native report submit.</summary>
public static class ValuationIssuanceGateCodes
{
    public const string Credentials = "credentials";
    public const string ParticipantCredentials = "participant_credentials";
    public const string DeedNatureMatch = "deed_nature_match";
    public const string MinAdoptedComparables = "min_adopted_comparables";
    public const string CostLandEstimateComplete = "cost_land_estimate_complete";
    public const string ComparableWeights = "comparable_weights";
    public const string ReconciliationWeights = "reconciliation_weights";
    public const string FinalOpinion = "final_opinion";
 /// <summary>dictionary types marked required must have a printable upload.</summary>
    public const string RequiredAttachments = "required_attachments";
    /// <summary>Every «مستند ذو قيمة» the appraiser used is approved by the case specialist.</summary>
    public const string ValueDocuments = "value_documents";
    /// <summary>The specialist issued the case-study report the appraisal is built on.</summary>
    public const string StudyReportIssued = "study_report_issued";
    /// <summary>
    /// Round 2: every non-zero adjustment factor and every manual weight of an
    /// adopted comparable is explained (≥ 10 characters). Suffixed per table: <c>_market</c> /
    /// <c>_land_within_cost</c>.
    /// </summary>
    public const string AdjustmentRationales = "adjustment_rationales";
}

public readonly record struct ValuationIssuanceGateCheck(
    string Code,
    string LabelAr,
    bool Passed,
    bool IsHard,
    string? DetailAr,
    bool IsWarning = false);

public static class ValuationIssuanceGateRules
{
    public static ValuationIssuanceGateCheck Credentials(
        string? licenseExpiresAt,
        string? membershipExpiresAt,
        DateOnly today)
    {
        var ok = ValuerCredentialRules.AllowsIssuance(
            licenseExpiresAt,
            membershipExpiresAt,
            today,
            out var block);
        var warn = !ok
            ? false
            : ValuerCredentialRules.IsWithinWarningWindow(licenseExpiresAt, today)
              || ValuerCredentialRules.IsWithinWarningWindow(membershipExpiresAt, today);
        return new ValuationIssuanceGateCheck(
            ValuationIssuanceGateCodes.Credentials,
            "ترخيص وعضوية المقيّم المعتمد",
            ok,
            IsHard: true,
            DetailAr: ok
                ? (warn ? "تنبيه: أقل من 60 يوماً على انتهاء أحد الاعتمادات" : null)
                : block,
            IsWarning: warn);
    }

    public readonly record struct RosterParticipantCredentials(
        string NameAr,
        string? LicenseExpiresAt,
        string? MembershipExpiresAt);

    /// <summary>
    /// Active report participants (org roster) use the same dual license+membership
    /// hard gate as the certified valuer. Empty roster is not a block.
    /// </summary>
    public static ValuationIssuanceGateCheck ParticipantCredentials(
        IReadOnlyList<RosterParticipantCredentials> participants,
        DateOnly today)
    {
        if (participants.Count == 0)
        {
            return new ValuationIssuanceGateCheck(
                ValuationIssuanceGateCodes.ParticipantCredentials,
                "ترخيص وعضوية المشاركين",
                Passed: true,
                IsHard: true,
                DetailAr: null);
        }

        var failures = new List<string>();
        var warn = false;
        foreach (var p in participants)
        {
            var name = string.IsNullOrWhiteSpace(p.NameAr) ? "مشارك" : p.NameAr.Trim();
            var ok = ValuerCredentialRules.AllowsIssuance(
                p.LicenseExpiresAt,
                p.MembershipExpiresAt,
                today,
                out var block);
            if (!ok)
                failures.Add($"{name}: {block}");
            else if (
                ValuerCredentialRules.IsWithinWarningWindow(p.LicenseExpiresAt, today)
                || ValuerCredentialRules.IsWithinWarningWindow(p.MembershipExpiresAt, today))
            {
                warn = true;
            }
        }

        var passed = failures.Count == 0;
        return new ValuationIssuanceGateCheck(
            ValuationIssuanceGateCodes.ParticipantCredentials,
            "ترخيص وعضوية المشاركين",
            passed,
            IsHard: true,
            DetailAr: passed
                ? (warn ? "تنبيه: أقل من 60 يوماً على انتهاء اعتماد أحد المشاركين" : null)
                : "عضوية/ترخيص مشارك تمنع الإصدار — " + string.Join("؛ ", failures),
            IsWarning: warn);
    }

    public static ValuationIssuanceGateCheck DeedNatureMatch(
        DeedKind deedKind,
        string? matchOutcome)
    {
        var ok = DeedKindRules.AllowsValuationCalc(deedKind, matchOutcome);
        string? detail = null;
        if (!ok)
        {
            detail = DeedKindRules.RequiresDeedNatureMatchGate(deedKind)
                ? "صك تقليدي — يلزم مخرج مطابقة الصك/الطبيعة = مطابق قبل الإصدار"
                : "مطابقة الصك/الطبيعة غير مكتملة";
        }

        return new ValuationIssuanceGateCheck(
            ValuationIssuanceGateCodes.DeedNatureMatch,
            "مطابقة الصك والطبيعة",
            ok,
            IsHard: true,
            DetailAr: detail);
    }

    /// <summary>
    /// A valuation is built on the specialist's case-study report, so it cannot be issued before that
    /// report is. A defensive mirror of the appraiser's submit gate (hard, no bypass).
    /// <paramref name="studyReportIssued"/> null = the case-study side did not say (older host during a
    /// rolling deploy) — not a block; false = no issued report.
    /// </summary>
    public static ValuationIssuanceGateCheck StudyReportIssued(bool? studyReportIssued)
    {
        var ok = studyReportIssued != false;
        return new ValuationIssuanceGateCheck(
            ValuationIssuanceGateCodes.StudyReportIssued,
            "تقرير دراسة الحالة صادر",
            ok,
            IsHard: true,
            DetailAr: ok ? null : "لم يُصدر الأخصائي تقرير دراسة الحالة بعد — لا يصدر التقييم قبله");
    }

    public static ValuationIssuanceGateCheck MinAdoptedComparables(int adoptedCount) =>
        new(
            ValuationIssuanceGateCodes.MinAdoptedComparables,
            "مقارن معتمد واحد على الأقل",
            adoptedCount >= ValuationComparableSelectionRules.MinimumAdoptedForMarketApproach,
            IsHard: true,
            DetailAr: adoptedCount < ValuationComparableSelectionRules.MinimumAdoptedForMarketApproach
                ? "يلزم مقارن معتمد واحد على الأقل (منطق-التسويات)"
                : null);

    /// <summary>
    /// Approach-aware comps gate: market → market comps; cost → land_within_cost comps.
    /// Skipped (pass) when the approach is off.
    /// Adjustments logic: at least one.
    /// </summary>
    public static ValuationIssuanceGateCheck MinAdoptedComparablesForApproach(
        string codeSuffix,
        string labelAr,
        bool approachEnabled,
        int adoptedCount) =>
        new(
            $"{ValuationIssuanceGateCodes.MinAdoptedComparables}_{codeSuffix}",
            labelAr,
            !approachEnabled
                || adoptedCount >= ValuationComparableSelectionRules.MinimumAdoptedForMarketApproach,
            IsHard: true,
            DetailAr: approachEnabled
                && adoptedCount < ValuationComparableSelectionRules.MinimumAdoptedForMarketApproach
                ? $"يلزم مقارن معتمد واحد على الأقل ({labelAr})"
                : null);

    public static ValuationIssuanceGateCheck CostLandEstimateComplete(
        bool costApproachEnabled,
        bool landEstimateComplete) =>
        new(
            ValuationIssuanceGateCodes.CostLandEstimateComplete,
            "اكتمال تقدير الأرض ضمن أسلوب التكلفة",
            !costApproachEnabled || landEstimateComplete,
            IsHard: true,
            DetailAr: costApproachEnabled && !landEstimateComplete
                ? "أسلوب التكلفة مفعّل وقيمة الأرض غير مكتملة — يلزم مقارنات أراضٍ فضاء ثم حفظ التكلفة"
                : null);

    /// <summary>
    /// Round 2: a blank rationale on a non-zero factor (+10٪) or a manual weight stays a savable draft,
    /// but the valuation is not issued — nor handed over — until each is explained in at least
    /// <see cref="JustificationRules.RequiredMinLength"/> characters. Every unexplained item is named
    /// (comparable — factor (percent) / manual weight). Skipped (pass) when the table is not in use.
    /// </summary>
    public static ValuationIssuanceGateCheck AdjustmentRationales(
        string codeSuffix,
        string tableLabelAr,
        bool approachEnabled,
        IReadOnlyList<string> unexplainedAr)
    {
        var fails = approachEnabled && unexplainedAr.Count > 0;
        return new(
            $"{ValuationIssuanceGateCodes.AdjustmentRationales}_{codeSuffix}",
            $"مبررات التسويات والأوزان اليدوية ({tableLabelAr})",
            !fails,
            IsHard: true,
            DetailAr: fails
                ? $"تسويات أو أوزان يدوية بلا مبرر ({tableLabelAr}) — اكتب لكلٍّ منها مبرراً لا يقل عن {JustificationRules.RequiredMinLength} أحرف: "
                  + string.Join("، ", unexplainedAr)
                : null);
    }

    public static ValuationIssuanceGateCheck ComparableWeights(
        string codeSuffix,
        string labelAr,
        bool approachEnabled,
        bool weightsSumTo100,
        int adoptedCount) =>
        new(
            $"{ValuationIssuanceGateCodes.ComparableWeights}_{codeSuffix}",
            labelAr,
            !approachEnabled || adoptedCount == 0 || weightsSumTo100,
            IsHard: true,
            DetailAr: approachEnabled && adoptedCount > 0 && !weightsSumTo100
                ? $"مجموع أوزان المقارنات المعتمدة ≠ 100٪ ({labelAr})"
                : null);

    public static ValuationIssuanceGateCheck ComparableWeights(bool weightsSumTo100, int adoptedCount) =>
        ComparableWeights("market", "أوزان مقارنات أسلوب السوق = 100٪", true, weightsSumTo100, adoptedCount);

    public static ValuationIssuanceGateCheck ReconciliationWeights(
        bool hasReconciliation,
        bool weightsSumTo100) =>
        new(
            ValuationIssuanceGateCodes.ReconciliationWeights,
            "نسب مشاركة الأساليب = 100٪",
            hasReconciliation && weightsSumTo100,
            IsHard: true,
            DetailAr: !hasReconciliation
                ? "لم يُحفظ ترجيح الأساليب / الرأي النهائي"
                : (!weightsSumTo100 ? "مجموع نسب المشاركة ≠ 100٪" : null));

    public static ValuationIssuanceGateCheck FinalOpinion(decimal finalOpinionValue) =>
        new(
            ValuationIssuanceGateCodes.FinalOpinion,
            "الرأي النهائي للقيمة",
            finalOpinionValue > 0m,
            IsHard: true,
            DetailAr: finalOpinionValue <= 0m ? "الرأي النهائي غير محسوب أو صفر" : null);

    public const string SurveyAttachmentKey = "survey";

    public static bool IsSurveyAttachmentKey(string? key) =>
        string.Equals(
            (key ?? "").Trim(),
            SurveyAttachmentKey,
            StringComparison.OrdinalIgnoreCase);

    /// <summary>
    /// Registered title / approved plan / unit-inside-building never owe a survey PDF,
    /// even when the attachments list marks التقرير المساحي required for أرض.
    /// </summary>
    public static IReadOnlyList<T> RequiredAttachmentsForProperty<T>(
        IEnumerable<T> required,
        Func<T, string> keySelector,
        bool propertyRequiresSurvey)
    {
        if (propertyRequiresSurvey) return required as IReadOnlyList<T> ?? required.ToList();
        return required.Where(t => !IsSurveyAttachmentKey(keySelector(t))).ToList();
    }

    /// <summary>
    /// Where the property's documents are filed: intake documents under «PO:propertyId», party
    /// uploads under the property id, and the surveyor's «التقرير المساحي» under the survey task id.
    /// </summary>
    public static IReadOnlyList<string> AttachmentScopeKeys(
        string propertyId,
        string? poNumber,
        IEnumerable<Guid> surveyTaskIds)
    {
        var keys = new List<string> { propertyId };
        if (!string.IsNullOrWhiteSpace(poNumber))
            keys.Add($"{poNumber.Trim()}:{propertyId}");
        foreach (var taskId in surveyTaskIds)
        {
            var key = taskId.ToString("D");
            if (taskId != Guid.Empty && !keys.Contains(key, StringComparer.Ordinal)) keys.Add(key);
        }
        return keys;
    }

 /// <summary>required dictionary types (matching the property type) need a printable upload.</summary>
    public static ValuationIssuanceGateCheck RequiredAttachments(IReadOnlyList<string> missingLabelsAr) =>
        new(
            ValuationIssuanceGateCodes.RequiredAttachments,
            "المرفقات الإلزامية",
            missingLabelsAr.Count == 0,
            IsHard: true,
            DetailAr: missingLabelsAr.Count == 0
                ? null
                : "مرفقات إلزامية بلا رفع مصنّف للطباعة: " + string.Join("، ", missingLabelsAr));

    /// <summary>
    /// Documents used in the valuation must be approved by the case specialist, and a document
    /// indicator cannot duplicate an approach the system now values internally.
    /// </summary>
    public static ValuationIssuanceGateCheck ValueDocuments(
        IReadOnlyList<string> notApprovedLabelsAr,
        IReadOnlyList<string> conflictingLabelsAr)
    {
        var parts = new List<string>();
        if (notApprovedLabelsAr.Count > 0)
            parts.Add("مستندات ذات قيمة غير معتمدة من الأخصائي: " + string.Join("، ", notApprovedLabelsAr));
        if (conflictingLabelsAr.Count > 0)
            parts.Add("مؤشر من مستند لأسلوب مستخدم داخليًا: " + string.Join("، ", conflictingLabelsAr));
        return new(
            ValuationIssuanceGateCodes.ValueDocuments,
            "المستندات ذات القيمة",
            parts.Count == 0,
            IsHard: true,
            DetailAr: parts.Count == 0 ? null : string.Join(" · ", parts));
    }

    public static bool AllowsIssuance(IEnumerable<ValuationIssuanceGateCheck> checks) =>
        checks.Where(c => c.IsHard).All(c => c.Passed);
}
