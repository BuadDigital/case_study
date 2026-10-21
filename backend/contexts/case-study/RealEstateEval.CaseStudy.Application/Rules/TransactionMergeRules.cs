using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Application.Rules;

/// <summary>
/// Pure merge / unmerge rules (decision 2026-10-19). Merge: by the case-study specialist, with a
/// link kind and a reason; never a transaction already merged, never a source that already
/// carries an official reference, never a deed handed over to Enfaz.
/// Omar 2026-10-20: the only stage condition is that every deed went through intake — work order,
/// primary data and the bourse inquiry (or was entered with its bourse data already filled, the
/// rare deed already in the system). Inspection, study and the rest are NOT conditions: a
/// transaction may be merged before or after distribution.
/// Unmerge: only while the transaction has no official reference, with a reason.
/// </summary>
public static class TransactionMergeRules
{
    public const int MinReasonLength = 5;

    public const string ReasonRequiredAr = "المبرر إلزامي (خمسة أحرف على الأقل)";
    public const string LinkKindRequiredAr = "حدّد نوع الارتباط: مبنى واحد أو أعيان بعقد";
    public const string NoDeedsAr = "اختر صكًا واحدًا على الأقل للدمج";
    public const string TargetMergedAr = "هذه المعاملة مدمجة في معاملة أخرى — افتح المعاملة الجامعة";
    public const string SameTransactionAr = "الصك في هذه المعاملة أصلًا";
    public const string SourceMergedAr = "معاملة هذا الصك مدمجة في معاملة أخرى";
    public const string SourceConfirmedAr = "لمعاملة هذا الصك رقم رسمي — الدمج بعد الاعتماد يكون بنسخة جديدة (مرحلة لاحقة)";
    public const string HandedOverAr = "الصك مرفوع على إنفاذ — لا دمج ولا فك بعد الرفع";
    public const string BoursePendingAr = "الصك لم يُستكمل استعلام البورصة بعد";
    public const string RemovedAr = "الصك محذوف";
    public const string NotInTransactionAr = "الصك ليس في هذه المعاملة";
    public const string ConfirmedNoUnmergeAr = "للمعاملة رقم رسمي — لا يُفك الدمج بعد تثبيت الرقم";
    public const string LastDeedAr = "المعاملة بصك واحد — لا شيء يُفك";

    public static string? ValidateReason(string? reason) =>
        (reason ?? "").Trim().Length < MinReasonLength ? ReasonRequiredAr : null;

    public static string? ValidateLinkKind(string? kind) =>
        TransactionLinkKinds.IsValid((kind ?? "").Trim()) ? null : LinkKindRequiredAr;

    /// <summary>A deed's own stage condition: intake done (bourse completed), not handed over.</summary>
    public static string? DeedStageBlock(WorkOrderProperty deed)
    {
        if (deed.IsHandedOverToEnfaz) return HandedOverAr;
        if (!deed.BourseDataCompleted) return BoursePendingAr;
        return null;
    }

    /// <summary>Why a deed cannot join the target transaction; null when it can.</summary>
    public static string? BlockedReason(
        WorkOrderProperty deed,
        Transaction? source,
        Guid targetTransactionId)
    {
        if (deed.IsRemoved) return RemovedAr;
        if (deed.TransactionId == targetTransactionId) return SameTransactionAr;
        if (source is null) return SourceMergedAr;
        if (source.IsMerged) return SourceMergedAr;
        if (source.IsConfirmed) return SourceConfirmedAr;
        return DeedStageBlock(deed);
    }

    public static string? ValidateTarget(Transaction target, IEnumerable<WorkOrderProperty> targetDeeds)
    {
        if (target.IsMerged) return TargetMergedAr;
        if (targetDeeds.Any(d => d.IsHandedOverToEnfaz)) return HandedOverAr;
        return null;
    }

    public static string? ValidateUnmerge(Transaction transaction, WorkOrderProperty? deed, int deedCount)
    {
        if (transaction.IsMerged) return TargetMergedAr;
        if (transaction.IsConfirmed) return ConfirmedNoUnmergeAr;
        if (deed is null || deed.TransactionId != transaction.Id) return NotInTransactionAr;
        if (deed.IsHandedOverToEnfaz) return HandedOverAr;
        if (deedCount < 2) return LastDeedAr;
        return null;
    }
}
