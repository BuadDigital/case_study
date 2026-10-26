using RealEstateEval.Application.Contracts;
using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.CaseStudy.Application.Rules;

/// <summary>
/// Decision D2: the appraiser's hand-over («اعتماد التقييم وإرسال») is refused while an issuance gate
/// he must see fixed first blocks — every blocker is listed, each with who fixes it. What the case
/// specialist completes AFTER the hand-over (the report attachments: deed copy, survey document, …)
/// does not hold the hand-over up; it stays on the list as «سيكملها الأخصائي».
/// The appraiser screen mirrors this split in <c>handover-blockers.ts</c>; keep the codes in step.
/// </summary>
public static class AppraisalHandOverGateRules
{
    public const string ErrorKey = "issuanceGates";

    public const string UnverifiedAr = "تعذّر التحقق من بوابات الإصدار — أعد المحاولة";

    public const string RefusedPrefixAr = "لا يُسلَّم التقييم قبل معالجة ما يلي: ";

    public const string AppraiserOwnerAr = "المقيّم";
    public const string SpecialistAfterHandOverOwnerAr = "سيكملها الأخصائي بعد التسليم";
    public const string SpecialistOwnerAr = "أخصائي دراسة الحالة";
    public const string ValueDocumentsOwnerAr = "أخصائي دراسة الحالة يعتمد المستند، أو يُزال استخدامه";
    public const string AdministrationOwnerAr = "إدارة المنشأة (اعتمادات المقيّمين)";

    public sealed record Blocker(string Code, string TextAr, string OwnerAr, bool BlocksHandOver);

    /// <summary>Gates the specialist fills in his report draft after the hand-over.</summary>
    public static bool IsSpecialistAfterHandOver(string? code) =>
        string.Equals(code?.Trim(), ValuationIssuanceGateCodes.RequiredAttachments, StringComparison.OrdinalIgnoreCase);

    public static string OwnerOf(string? code)
    {
        var c = (code ?? "").Trim().ToLowerInvariant();
        if (IsSpecialistAfterHandOver(c)) return SpecialistAfterHandOverOwnerAr;
        return c switch
        {
            ValuationIssuanceGateCodes.Credentials or ValuationIssuanceGateCodes.ParticipantCredentials =>
                AdministrationOwnerAr,
            ValuationIssuanceGateCodes.DeedNatureMatch or ValuationIssuanceGateCodes.StudyReportIssued =>
                SpecialistOwnerAr,
            ValuationIssuanceGateCodes.ValueDocuments => ValueDocumentsOwnerAr,
            // D17: the income approach inputs (and alerts 26–28) are the appraiser's to complete.
            ValuationIssuanceGateCodes.IncomeApproachComplete => AppraiserOwnerAr,
            _ => AppraiserOwnerAr,
        };
    }

    /// <summary>The numbered item for the unissued case-study report (round 2: no longer glued on unnumbered).</summary>
    public const string StudyReportNotIssuedItemAr = "لم يُصدر الأخصائي تقرير دراسة الحالة بعد";

    /// <summary>A failing weights gate (comparable weights of either table, or the approach shares).</summary>
    public static bool IsWeightsGate(string? code)
    {
        var c = (code ?? "").Trim().ToLowerInvariant();
        return c == ValuationIssuanceGateCodes.ReconciliationWeights
               || c.StartsWith(ValuationIssuanceGateCodes.ComparableWeights, StringComparison.Ordinal);
    }

    /// <summary>
    /// Every failing hard gate and blocking methodology alert, in the gates' order. Alert 16 («مجموع
    /// الأوزان ≠ 100٪») repeats the weights gates, so it is not listed again when one of them fails.
    /// </summary>
    public static IReadOnlyList<Blocker> Classify(ValuationIssuanceGatesSnapshotDto gates)
    {
        var list = new List<Blocker>();
        foreach (var g in gates.Gates.Where(g => g.IsHard && !g.Passed))
        {
            list.Add(new Blocker(
                g.Code,
                TextOf(g.DetailAr, g.LabelAr),
                OwnerOf(g.Code),
                BlocksHandOver: !IsSpecialistAfterHandOver(g.Code)));
        }
        var weightsGateFails = list.Any(b => IsWeightsGate(b.Code));
        foreach (var a in gates.MethodologyAlerts.Where(a => a.BlocksIssuance))
        {
            if (weightsGateFails && string.Equals(
                    a.Code, ValuationMethodologyAlertCodes.WeightsNot100, StringComparison.OrdinalIgnoreCase))
                continue;
            list.Add(new Blocker(
                a.Code,
                TextOf(a.DetailAr, a.LabelAr),
                AppraiserOwnerAr,
                BlocksHandOver: true));
        }
        return list;
    }

    /// <summary>
    /// The submit field error, or null when nothing the hand-over waits on blocks. Null gates (the
    /// request is gone, or the host cannot read them) do not block — a failed read is the caller's
    /// fail-closed <see cref="UnverifiedAr"/>.
    /// </summary>
    /// <param name="studyReportListed">
    /// The case-study report is not issued (the submit refuses for it anyway): when anything else
    /// blocks too, it is the first numbered item of this one message — the submit then drops its own
    /// separate study-report error — and the valuation's study-report gate is not listed twice.
    /// </param>
    public static Dictionary<string, string>? HandOverError(
        ValuationIssuanceGatesSnapshotDto? gates,
        bool studyReportListed = false)
    {
        if (gates is null) return null;
        var blocking = Classify(gates)
            .Where(b => b.BlocksHandOver)
            .Where(b => !studyReportListed || !string.Equals(
                b.Code, ValuationIssuanceGateCodes.StudyReportIssued, StringComparison.OrdinalIgnoreCase))
            .ToList();
        if (blocking.Count == 0) return null;
        if (studyReportListed)
        {
            blocking.Insert(0, new Blocker(
                ValuationIssuanceGateCodes.StudyReportIssued,
                StudyReportNotIssuedItemAr,
                SpecialistOwnerAr,
                BlocksHandOver: true));
        }
        var items = blocking.Select((b, i) => $"{i + 1}) {b.TextAr} — يعالجها: {b.OwnerAr}");
        return new Dictionary<string, string> { [ErrorKey] = RefusedPrefixAr + string.Join("؛ ", items) };
    }

    private static string TextOf(string? detail, string label) =>
        string.IsNullOrWhiteSpace(detail) ? label.Trim() : detail.Trim();
}
