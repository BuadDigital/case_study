using RealEstateEval.Domain;
using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.CaseStudy.Application.Rules;

/// <summary>
/// Validity of the deed↔nature match field on the case-study report (save and issue alike):
/// Unset is allowed on save, unknown tokens are rejected, فروق/تعذر need notes. (supersedes the
/// 2026-10-15 decision): a traditional deed's report is not issued before the specialist has chosen an
/// outcome — issuing locks the field, and the valuation gate (<see cref="DeedKindRules.AllowsValuationCalc"/>)
/// would otherwise block the appraiser's hand-over with no way left to set it.
/// </summary>
public static class CaseStudyReportDeedNatureMatchRules
{
    public const string OutcomeRequiredForIssueAr =
        "اختر نتيجة «مطابقة الصك على الطبيعة» من تبويب «مدخلات المعاين» قبل إصدار تقرير دراسة الحالة";

    /// <summary>
    /// Issue gate: the save rules, plus a chosen outcome when any deed of the transaction is traditional
    /// (a registered title has no match gate).
    /// </summary>
    public static Dictionary<string, string>? ValidateForIssue(
        string? outcome,
        string? notes,
        IEnumerable<DeedKind> transactionDeedKinds,
        bool inspectorSaidNotMatched = false)
    {
        var saveErrors = ValidateForSave(outcome, notes, inspectorSaidNotMatched);
        if (saveErrors is not null) return saveErrors;

        if (transactionDeedKinds.Any(DeedKindRules.RequiresDeedNatureMatchGate)
            && !DeedNatureMatchOutcomes.IsChosen(outcome))
        {
            return new Dictionary<string, string>
            {
                ["deedNatureMatchOutcome"] = OutcomeRequiredForIssueAr,
            };
        }

        return null;
    }

    /// <summary>
    /// «مطابق» chosen against the inspector's «غير مطابق» (2026-10-29 ruling).
    /// </summary>
    public static readonly string OverrideReasonRequiredAr =
        $"سبب اعتماد «مطابق» خلافاً لرأي المعاين مطلوب ({JustificationRules.RequiredMinLength} أحرف على الأقل)";

    /// <param name="inspectorSaidNotMatched">The field inspector's verdict was «غير مطابق».</param>
    public static Dictionary<string, string>? ValidateForSave(
        string? outcome,
        string? notes,
        bool inspectorSaidNotMatched = false)
    {
        var matchOutcome = (outcome ?? "").Trim().ToLowerInvariant();
        // IsKnown includes Unset — draft-friendly; matched is for submit / valuation.
        if (!DeedNatureMatchOutcomes.IsKnown(matchOutcome))
        {
            return new Dictionary<string, string>
            {
                ["deedNatureMatchOutcome"] = "مخرج المطابقة غير معروف",
            };
        }

        if (DeedNatureMatchOutcomes.RequiresNotes(matchOutcome)
            && string.IsNullOrWhiteSpace(notes))
        {
            return new Dictionary<string, string>
            {
                ["deedNatureMatchNotes"] = "ملاحظات المطابقة إلزامية عند «فروق» أو «مرشح تعذّر»",
            };
        }

        // The specialist may decide «مطابق» against the inspector, but says why (in the same notes).
        if (inspectorSaidNotMatched
            && matchOutcome == DeedNatureMatchOutcomes.Matched
            && !JustificationRules.MeetsRequiredMinimum(notes))
        {
            return new Dictionary<string, string> { ["deedNatureMatchNotes"] = OverrideReasonRequiredAr };
        }

        return null;
    }
}
