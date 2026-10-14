using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;

namespace RealEstateEval.CaseStudy.Application.Rules;

public static partial class WorkflowTaskLifecycleRules
{
    /// <summary>Refusal pointing the transition at the report that owns it.</summary>
    public const string CaseStudyParentPatchBlockedAr =
        "يُنجز الإصدار وإعادة الفتح من تقرير دراسة الحالة";

    /// <summary>
    /// The generic <c>PATCH /api/workflow-tasks/{id}</c> must not move a case-study parent in or
    /// out of «completed»: that transition is the issue / reopen of its report (which also locks
    /// or unlocks the party contributions and writes the audit trail). A patch that would complete
    /// it (status completed, or phase done) is refused unless it already is; a patch that would
    /// take a completed parent anywhere else (status other than completed, or a phase other than
    /// done) is refused too. Everything else passes — in particular <c>status: open</c> on a
    /// parent that is not completed, which is how a supervisor resolves an obstruction
    /// (phase obstruction → the phase it came from) or lifts a suspension.
    /// Other kinds are untouched here; this is the parent only.
    /// </summary>
    public static string? ClientPatchBlockReason(
        WorkflowTaskKind kind,
        WorkflowTaskStatus currentStatus,
        PatchWorkflowTaskRequest request)
    {
        if (kind == WorkflowTaskKind.PropertyAppraisal)
            return AppraisalClientPatchBlockReason(currentStatus, request);
        if (kind != CaseStudyPropertyKind) return null;

        WorkflowTaskStatus? status = WorkflowTaskStatusValues.TryParse(request.Status, out var parsedStatus)
            ? parsedStatus
            : null;
        WorkflowTaskPhase? phase = WorkflowTaskPhaseValues.TryParse(request.Phase, out var parsedPhase)
            ? parsedPhase
            : null;

        var wasCompleted = currentStatus == WorkflowTaskStatus.Completed;
        var completes = status == WorkflowTaskStatus.Completed || phase == WorkflowTaskPhase.Done;
        if (completes && !wasCompleted) return CaseStudyParentPatchBlockedAr;

        var leavesCompleted = (status.HasValue && status != WorkflowTaskStatus.Completed)
            || (phase.HasValue && phase != WorkflowTaskPhase.Done);
        if (wasCompleted && leavesCompleted) return CaseStudyParentPatchBlockedAr;

        return null;
    }

    /// <summary>Refusal for the appraiser's task: it completes only with the final issuance.</summary>
    public const string AppraisalPatchBlockedAr =
        "يكتمل تقييم العقار بإصدار التقرير النهائي، وتُعاد فتحه بنسخة جديدة من الأخصائي";

    /// <summary>
    /// The appraiser's task completes when the valuation report is finally issued (the delivery
    /// event) and leaves «completed» only through the specialist's new-version reopen — never by a
    /// bare status patch. Everything else (title, assignee, a repeated no-op) passes.
    /// </summary>
    private static string? AppraisalClientPatchBlockReason(
        WorkflowTaskStatus currentStatus,
        PatchWorkflowTaskRequest request)
    {
        WorkflowTaskStatus? status = WorkflowTaskStatusValues.TryParse(request.Status, out var parsedStatus)
            ? parsedStatus
            : null;
        var wasCompleted = currentStatus == WorkflowTaskStatus.Completed;

        if (status == WorkflowTaskStatus.Completed && !wasCompleted) return AppraisalPatchBlockedAr;
        if (wasCompleted && status.HasValue && status != WorkflowTaskStatus.Completed)
            return AppraisalPatchBlockedAr;
        return null;
    }
}
