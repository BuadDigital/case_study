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
            "ترخيص وعضوية المقيم المعتمد",
            ok,
            IsHard: true,
            DetailAr: ok
                ? (warn ? "تنبيه: أقل من 60 يومًا على انتهاء أحد الاعتمادات" : null)
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
                ? (warn ? "تنبيه: أقل من 60 يومًا على انتهاء اعتماد أحد المشاركين" : null)
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

    public static bool AllowsIssuance(IEnumerable<ValuationIssuanceGateCheck> checks) =>
        checks.Where(c => c.IsHard).All(c => c.Passed);
}
