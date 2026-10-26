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
    /// <remarks>
    /// How it works: returns «مرفوع على إنفاذ» when the deed is handed over to Enfaz, else «لم يُستكمل
    /// استعلام البورصة» when BourseDataCompleted is false, else null.
    /// Edge cases: the first gate asked every deed's inspection to be submitted/accepted; Omar
    /// corrected it (2026-10-20) to intake only, so a merge may come before distribution. A rare deed
    /// entered with its bourse data already filled also has BourseDataCompleted set and passes.
    /// </remarks>
    public static string? DeedStageBlock(WorkOrderProperty deed)
    {
        if (deed.IsHandedOverToEnfaz) return HandedOverAr;
        if (!deed.BourseDataCompleted) return BoursePendingAr;
        return null;
    }

    /// <summary>Why a deed cannot join the target transaction; null when it can.</summary>
    /// <remarks>
    /// How it works, first failing check wins: removed deed → already in the target → source
    /// transaction missing or itself merged → source already has its official PR number → the
    /// deed's own stage (<see cref="DeedStageBlock"/>).
    /// Edge cases: a source with a PR number is refused because merging after approval needs a new
    /// version (later phase); the deed search reuses this to tell which deeds can join.
    /// </remarks>
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

    /// <summary>The receiving transaction: not itself folded into another, and none of its deeds handed over to Enfaz.</summary>
    /// <remarks>
    /// How it works: «مدمجة في معاملة أخرى» when the target was merged into another transaction,
    /// «مرفوع على إنفاذ» when any of its deeds is handed over, else null.
    /// Edge cases: a target with an official PR number is allowed — it keeps its number and the
    /// source deeds join under it.
    /// </remarks>
    public static string? ValidateTarget(Transaction target, IEnumerable<WorkOrderProperty> targetDeeds)
    {
        if (target.IsMerged) return TargetMergedAr;
        if (targetDeeds.Any(d => d.IsHandedOverToEnfaz)) return HandedOverAr;
        return null;
    }

    /// <summary>Taking a deed back out: only before the official PR number, never a handed-over deed, never the last deed.</summary>
    /// <remarks>
    /// How it works, first failing check wins: transaction merged into another → transaction has its
    /// PR number → deed missing or not in this transaction → deed handed over to Enfaz → fewer than
    /// two deeds left (nothing to take out).
    /// Edge cases: once the PR number exists nothing comes out, so the printed reference always
    /// covers the same deeds.
    /// </remarks>
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
