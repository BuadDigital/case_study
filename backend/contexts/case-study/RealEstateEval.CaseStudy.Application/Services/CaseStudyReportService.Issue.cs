using RealEstateEval.Application;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Domain;
using RealEstateEval.Shared.Contracts;

namespace RealEstateEval.CaseStudy.Application.Services;

/// <summary>
/// Issuing the case-study report and reopening it. Issuing is the specialist's decision that
/// completes the study and opens the appraiser's submission; both actions are the case
/// specialist's alone and each commits the report, the parent task and the party-contribution lock
/// as ONE transaction.
/// </summary>
public partial class CaseStudyReportService
{
    private const int MinReopenReasonLength = 10;
    private const int MaxReopenReasonLength = 1000;

    public const string IssueRoleDeniedAr =
        "ليس لديك صلاحية إصدار تقرير دراسة الحالة — الإصدار لأخصائي دراسة الحالة";

    public const string ReopenRoleDeniedAr =
        "ليس لديك صلاحية إعادة فتح تقرير دراسة الحالة — الإعادة لأخصائي دراسة الحالة";

    public const string ActiveFailureBlocksIssueAr =
        "عقار عليه تعذّر نشط — لا يُصدر تقرير دراسة الحالة قبل حل التعذّر";

    public const string EnfazHandoverKey = "enfazHandover";

    public const string EnfazHandoverConfirmAr =
        "سُلِّمت المعاملة على إنفاذ — إعادة فتح التقرير تمسح ختم التسليم، أكّد ذلك للمتابعة";

    private const string StaleSessionAr =
        "تم تحديث النموذج من جلسة أخرى. أعد المحاولة — إن استمر الأمر حدّث الصفحة ثم احفظ.";

    private static Dictionary<string, string> Fail(string message) => new() { ["_"] = message };

    // ---------------------------------------------------------------- issue

    /// <summary>Issues the case-study report (the transaction's one study) — case specialist only.</summary>
    /// <remarks>
    /// How it works: 1) refuses an actor of another role; 2) re-points the task id to the holder deed's parent
    /// task (phase 4), so issuing from any deed of the transaction issues the one study; 3) runs
    /// <see cref="IssueOnceAsync"/>, retrying up to three times on a row-version (xmin) clash with a
    /// clean tracker, then answers «تم تحديث النموذج من جلسة أخرى».
    /// Edge cases: an ordinary single-deed property resolves to its own task, unchanged.
    /// </remarks>
    public async Task<(CaseStudyReportDto? Result, Dictionary<string, string>? Errors)> IssueAsync(
        Guid taskId,
        CaseStudyReportDto report,
        CaseStudyReportActor? actor = null,
        CancellationToken cancellationToken = default)
    {
        if (actor is not null && !PoRoleMatrixRules.CanIssueCaseStudyReport(actor.PrototypeRole))
            return (null, Fail(IssueRoleDeniedAr));

        // Phase 4: the transaction's one study is issued from the holder deed's task, whichever deed asked.
        taskId = await _db.ResolveStudyTaskIdAsync(taskId, cancellationToken);

        // Autosave / multi-tab can race on xmin — retry with a fresh load, like a plain save.
        const int maxAttempts = 3;
        for (var attempt = 1; attempt <= maxAttempts; attempt++)
        {
            try
            {
                return await IssueOnceAsync(taskId, report, actor, cancellationToken);
            }
            catch (PersistenceConcurrencyException) when (attempt < maxAttempts)
            {
                _db.DiscardTrackedChanges();
            }
            catch (PersistenceConcurrencyException)
            {
                _db.DiscardTrackedChanges();
                return (null, Fail(StaleSessionAr));
            }
        }

        return (null, Fail(StaleSessionAr));
    }

    /// <summary>One issue attempt on the holder task: gates, then one database transaction.</summary>
    /// <remarks>
    /// How it works: 1) loads the task (case-study kind, not cancelled) and the stored report;
    /// 2) lists the parent tasks of every live deed of the transaction (holder first; the task alone
    /// when none); 3) gate 1: a blocked task or an active failure on ANY deed refuses; 4) the deed ↔
    /// nature outcome and the 100% answers gates; 5) in ONE transaction: writes the report as issued,
    /// confirms the transaction's PR number, then for every deed's parent completes the task, locks
    /// its party contributions and writes «إصدار تقرير دراسة الحالة» on that deed's timeline; 6) audit
    /// and appraiser notifications.
    /// Edge cases: a repeat call on an issued + completed study is a no-op; an issued report with an
    /// open parent (half-applied legacy issue) only finishes completion and locks; a PR allocation
    /// error throws so the whole issue rolls back — the study is never issued without its PR number,
    /// and the PR stays on a later reopen (gap-free).
    /// </remarks>
    private async Task<(CaseStudyReportDto? Result, Dictionary<string, string>? Errors)> IssueOnceAsync(
        Guid taskId,
        CaseStudyReportDto report,
        CaseStudyReportActor? actor,
        CancellationToken cancellationToken)
    {
        var task = await _db.GetTaskAsync(taskId, cancellationToken);
        if (task is null) return (null, null);
        if (task.Kind != CaseStudyPropertyKind)
            return (null, Fail("تقرير دراسة الحالة يُصدر على مهمة دراسة العقار فقط"));
        if (task.Status == WorkflowTaskStatus.Cancelled)
            return (null, Fail("المهمة ملغاة — لا يُصدر تقرير دراسة الحالة لها"));

        var existing = await _db.GetFormAsync(taskId, party: false, track: false, cancellationToken);
        var alreadyIssued = existing is not null && IsIssuedStatus(existing.Status);

        // Already issued AND the study completed: a repeat call is a no-op.
        if (alreadyIssued && task.Status == WorkflowTaskStatus.Completed)
            return (ToDto(existing!), null);

        var propertyId = ResolvePropertyId(report, existing, task);

        // Phase 4: every live deed of the transaction completes with the one study (the holder first).
        var parents = await _db.ListTransactionParentTasksAsync(taskId, cancellationToken);
        if (parents.Count == 0) parents = [task];

        // Gate 1 — an active failure / blocked task on ANY deed. (Not the data gates: an issued report passed them.)
        foreach (var parent in parents)
        {
            if (parent.Status == WorkflowTaskStatus.Blocked
                || await HasActiveFailureAsync(parent, parent.Id == task.Id ? propertyId : parent.PropertyId, cancellationToken))
            {
                return (null, Fail(ActiveFailureBlocksIssueAr));
            }
        }

        // Re-entry after a half-applied legacy issue: the report is issued but the parent is still
        // open (or its party forms were never locked). Finish the job; nothing else changes.
        if (alreadyIssued)
        {
            var healedAt = _time.UtcNow();
            await _db.ExecuteInTransactionAsync(
                async ct =>
                {
                    foreach (var parent in parents)
                    {
                        await TryCompleteCaseStudyWorkflowTaskAsync(parent.Id, ct);
                        await LockPartyContributionsAsync(parent.Id, healedAt, ct);
                    }
                },
                cancellationToken);
            return (ToDto(existing!), null);
        }

        // A traditional deed's report needs the specialist's deed ↔ nature outcome before it is
        // issued (the issue locks the field, and the valuation gate needs it); the field's own validity
        // (a known token; notes when فروق / تعذّر) is checked as on every save.
        var matchErrors = CaseStudyReportDeedNatureMatchRules.ValidateForIssue(
            report.DeedNatureMatchOutcome,
            report.DeedNatureMatchNotes,
            await TransactionDeedKindsAsync(parents, task, propertyId, cancellationToken));
        if (matchErrors is not null) return (null, matchErrors);

        // Gate 2 — 100% of the questions the matrix asks, from the answers in THIS request.
        // With the lookup wired this fails closed (unreadable / empty matrix refuses the issue).
        if (_infoRoles is not null)
        {
            var matrix = await _infoRoles.GetQuestionRolesAsync(cancellationToken);
            var completeness = CaseStudyAnswerCompletenessRules.Evaluate(matrix, report.Answers);
            var completenessErrors = CaseStudyAnswerCompletenessRules.ToErrors(completeness);
            if (completenessErrors is not null) return (null, completenessErrors);
        }

        var now = _time.UtcNow();
        CaseStudyReport? entity = null;
        var previousMatchOutcome = "";

        // ONE transaction: the report, the parent completion (+ the inspector ledger it ensures —
        // idempotent) and the party-contribution lock commit or roll back together.
        await _db.ExecuteInTransactionAsync(
            async ct =>
            {
                // The execution strategy may re-run this block after a transient failure: start from a clean tracker.
                _db.DiscardTrackedChanges();
                entity = await _db.GetFormAsync(taskId, party: false, track: true, ct);
                previousMatchOutcome = (entity?.DeedNatureMatchOutcome ?? "").Trim();
                var previousAnswers = ParseAnswers(entity?.AnswersJson);
                var previousRemarks = ReadRemarkMap(entity);
                var previousProvenance = CaseStudyAnswerProvenance.Parse(entity?.AnswerProvenanceJson);

                if (entity is null)
                {
                    entity = new CaseStudyReport
                    {
                        Id = Guid.NewGuid(),
                        TaskId = taskId,
                        IsPartyContribution = false,
                        CreatedAtUtc = now,
                    };
                    _db.AddForm(entity);
                }

                ApplyDto(entity, report, now, ReportStatusIssued);
                // The valuation side finds the report by property, so an issue always carries it.
                entity.PropertyId ??= propertyId;
                if (string.IsNullOrWhiteSpace(entity.PoNumber)) entity.PoNumber = task.PoNumber;

                if (actor is not null)
                {
                    await StampProvenanceAsync(
                        entity, report, previousAnswers, previousRemarks, previousProvenance,
                        actor, taskId, now, ct);
                }

                await _db.SaveChangesAsync(ct);

                // Issuing the study is one of the two moments that fix the
                // transaction's official PR reference (the valuation approval is the other).
                if (_transactions is not null && propertyId is Guid confirmPropertyId)
                {
                    var (_, referenceError) = await _transactions.ConfirmOfficialReferenceAsync(confirmPropertyId, now, ct);
                    if (referenceError is not null)
                        throw new InvalidOperationException(referenceError);
                }

                // Each deed's parent task completes and locks its contributions, and each deed's own
                // timeline records the issue (the folded deeds share the holder's study).
                foreach (var parent in parents)
                {
                    await TryCompleteCaseStudyWorkflowTaskAsync(parent.Id, ct);
                    await LockPartyContributionsAsync(parent.Id, now, ct);

                    var timelinePropertyId = parent.Id == task.Id ? propertyId : parent.PropertyId;
                    if (_timeline is not null && timelinePropertyId is Guid timelineId)
                    {
                        await _timeline.RecordAsync(
                            parent.PoNumber,
                            timelineId,
                            $"case-study-report:{taskId}:issued:{now:O}",
                            "إصدار تقرير دراسة الحالة",
                            string.IsNullOrWhiteSpace(actor?.DisplayName) ? null : actor!.DisplayName.Trim(),
                            PropertyTimelineTones.Done,
                            now,
                            ct);
                    }
                }
            },
            cancellationToken);

        await AuditAsync(
            actor,
            "case-study.report.issued",
            entity!,
            before: new { status = existing?.Status ?? CaseStudyReportStatuses.New },
            after: new
            {
                status = ReportStatusIssued,
                taskId,
                propertyId,
                poNumber = task.PoNumber,
            },
            cancellationToken);

        await NotifyAppraiserStudyReportIssuedAsync(entity!, propertyId, cancellationToken);
        await NotifyAppraiserOnMatchOutcomeAsync(taskId, entity!, previousMatchOutcome, cancellationToken);

        return (ToDto(entity!), null);
    }

    // -------------------------------------------------------------- helpers

    private static Guid? ResolvePropertyId(
        CaseStudyReportDto report,
        CaseStudyReport? existing,
        WorkflowTask task)
    {
        if (Guid.TryParse(report.PropertyId, out var fromDto) && fromDto != Guid.Empty) return fromDto;
        if (existing?.PropertyId is Guid stored && stored != Guid.Empty) return stored;
        return task.PropertyId;
    }

    private async Task AuditAsync(
        CaseStudyReportActor? actor,
        string action,
        CaseStudyReport report,
        object before,
        object after,
        CancellationToken cancellationToken)
    {
        if (_audit is null || _auditLog is null) return;

        await _auditLog.AppendAsync(_audit.Create(
            actorId: string.IsNullOrWhiteSpace(actor?.UserId) ? "system" : actor!.UserId.Trim(),
            action: action,
            entityType: "CaseStudyReport",
            entityId: report.Id.ToString("D"),
            before: before,
            after: after), cancellationToken);
    }
}
