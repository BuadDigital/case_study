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
        "عقار عليه تعذر نشط — لا يُصدر تقرير دراسة الحالة قبل حل التعذر";

    public const string EnfazHandoverKey = "enfazHandover";

    public const string EnfazHandoverConfirmAr =
        "سُلِّمت المعاملة على إنفاذ — إعادة فتح التقرير تمسح ختم التسليم، أكّد ذلك للمتابعة";

    private const string StaleSessionAr =
        "تم تحديث النموذج من جلسة أخرى. أعد المحاولة — إن استمر الأمر حدّث الصفحة ثم احفظ.";

    private static Dictionary<string, string> Fail(string message) => new() { ["_"] = message };

    // ---------------------------------------------------------------- issue

    public async Task<(CaseStudyReportDto? Result, Dictionary<string, string>? Errors)> IssueAsync(
        Guid taskId,
        CaseStudyReportDto report,
        CaseStudyReportActor? actor = null,
        CancellationToken cancellationToken = default)
    {
        if (actor is not null && !PoRoleMatrixRules.CanIssueCaseStudyReport(actor.PrototypeRole))
            return (null, Fail(IssueRoleDeniedAr));

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

        // Gate 1 — an active failure / blocked task. (Not the data gates: an issued report passed them.)
        if (task.Status == WorkflowTaskStatus.Blocked
            || await HasActiveFailureAsync(task, propertyId, cancellationToken))
        {
            return (null, Fail(ActiveFailureBlocksIssueAr));
        }

        // Re-entry after a half-applied legacy issue: the report is issued but the parent is still
        // open (or its party forms were never locked). Finish the job; nothing else changes.
        if (alreadyIssued)
        {
            var healedAt = _time.UtcNow();
            await _db.ExecuteInTransactionAsync(
                async ct =>
                {
                    await TryCompleteCaseStudyWorkflowTaskAsync(taskId, ct);
                    await LockPartyContributionsAsync(taskId, healedAt, ct);
                },
                cancellationToken);
            return (ToDto(existing!), null);
        }

        // Gate 2 — deed ↔ nature match.
        var deedKind = DeedKind.Traditional;
        if (propertyId is Guid matchPid && matchPid != Guid.Empty)
        {
            deedKind = await _db.GetPropertyDeedKindAsync(matchPid, cancellationToken)
                ?? DeedKind.Traditional;
        }

        var matchErrors = CaseStudyReportDeedNatureMatchRules.ValidateForSubmit(
            report.DeedNatureMatchOutcome,
            report.DeedNatureMatchNotes,
            deedKind);
        if (matchErrors is not null) return (null, matchErrors);

        // Gate 3 — 100% of the questions the matrix asks, from the answers in THIS request.
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
                await TryCompleteCaseStudyWorkflowTaskAsync(taskId, ct);
                await LockPartyContributionsAsync(taskId, now, ct);

                if (_timeline is not null && propertyId is Guid timelinePropertyId)
                {
                    await _timeline.RecordAsync(
                        task.PoNumber,
                        timelinePropertyId,
                        $"case-study-report:{taskId}:issued:{now:O}",
                        "إصدار تقرير دراسة الحالة",
                        string.IsNullOrWhiteSpace(actor?.DisplayName) ? null : actor!.DisplayName.Trim(),
                        PropertyTimelineTones.Done,
                        now,
                        ct);
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

    // --------------------------------------------------------------- reopen

    public async Task<(ReopenCaseStudyReportResultDto? Result, Dictionary<string, string>? Errors)> ReopenAsync(
        Guid taskId,
        string? reason,
        bool clearEnfazHandover,
        CaseStudyReportActor? actor = null,
        CancellationToken cancellationToken = default)
    {
        if (actor is not null && !PoRoleMatrixRules.CanReopenCaseStudyReport(actor.PrototypeRole))
            return (null, Fail(ReopenRoleDeniedAr));

        const int maxAttempts = 3;
        for (var attempt = 1; attempt <= maxAttempts; attempt++)
        {
            try
            {
                return await ReopenOnceAsync(taskId, reason, clearEnfazHandover, actor, cancellationToken);
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

    private async Task<(ReopenCaseStudyReportResultDto? Result, Dictionary<string, string>? Errors)> ReopenOnceAsync(
        Guid taskId,
        string? rawReason,
        bool clearEnfazHandover,
        CaseStudyReportActor? actor,
        CancellationToken cancellationToken)
    {
        var reason = (rawReason ?? "").Trim();
        if (reason.Length < MinReopenReasonLength)
        {
            return (null, new Dictionary<string, string>
            {
                ["reason"] = $"سبب إعادة الفتح مطلوب ({MinReopenReasonLength} أحرف على الأقل)",
            });
        }
        if (reason.Length > MaxReopenReasonLength)
        {
            return (null, new Dictionary<string, string> { ["reason"] = "السبب طويل جداً" });
        }

        var task = await _db.GetTaskAsync(taskId, cancellationToken);
        if (task is null) return (null, null);
        if (task.Kind != CaseStudyPropertyKind)
            return (null, Fail("تقرير دراسة الحالة يُعاد فتحه على مهمة دراسة العقار فقط"));

        var existing = await _db.GetFormAsync(taskId, party: false, track: false, cancellationToken);
        if (existing is null || !IsIssuedStatus(existing.Status))
            return (null, Fail("التقرير غير صادر — لا شيء لإعادة فتحه"));

        // A transaction handed over to Enfaz is frozen against reopening unless the specialist
        // confirms taking it back (which clears the handover stamp).
        var propertyId = existing.PropertyId ?? task.PropertyId;
        var handedOver = false;
        if (propertyId is Guid handoverPropertyId && handoverPropertyId != Guid.Empty)
        {
            var property = await _db.GetPropertyForUpdateAsync(handoverPropertyId, cancellationToken);
            handedOver = property?.IsHandedOverToEnfaz == true;
        }
        if (handedOver && !clearEnfazHandover)
            return (null, new Dictionary<string, string> { [EnfazHandoverKey] = EnfazHandoverConfirmAr });

        var appraiserSubmitted = await _db.HasSubmittedAppraisalPackageAsync(taskId, cancellationToken);
        var now = _time.UtcNow();
        CaseStudyReport? entity = null;
        var handoverCleared = false;

        await _db.ExecuteInTransactionAsync(
            async ct =>
            {
                // The execution strategy may re-run this block after a transient failure: start from a clean tracker.
                _db.DiscardTrackedChanges();
                entity = await _db.GetFormAsync(taskId, party: false, track: true, ct);
                if (entity is null) return;

                entity.Status = CaseStudyReportStatuses.Draft;
                entity.SavedAtUtc = now;
                entity.UpdatedAtUtc = now;

                if (handedOver && propertyId is Guid clearPropertyId)
                {
                    var property = await _db.GetPropertyForUpdateAsync(clearPropertyId, ct);
                    handoverCleared = property?.ClearEnfazHandover() == true;
                }

                await _db.SaveChangesAsync(ct);

                // Parent: Completed → Open, back in the case-study phase. The domain Reopen sets the
                // phase, the shell patch does not — so both fields are sent.
                if (task.Status == WorkflowTaskStatus.Completed)
                {
                    await _workflowTasks.PatchAsync(
                        taskId,
                        new PatchWorkflowTaskRequest
                        {
                            Status = WorkflowTaskStatusValues.Open,
                            Phase = WorkflowTaskPhaseValues.CaseStudy,
                        },
                        ct);
                }

                await UnlockOpenPartyContributionsAsync(taskId, now, ct);

                if (_timeline is not null && propertyId is Guid timelinePropertyId)
                {
                    await _timeline.RecordAsync(
                        task.PoNumber,
                        timelinePropertyId,
                        $"case-study-report:{taskId}:reopened:{now:O}",
                        "إعادة فتح تقرير دراسة الحالة",
                        reason,
                        PropertyTimelineTones.Warn,
                        now,
                        ct);
                }
            },
            cancellationToken);

        if (entity is null) return (null, Fail("التقرير غير صادر — لا شيء لإعادة فتحه"));

        // No fee reversal: the inspector ledger is keyed by (transaction, deed, user) and written
        // idempotently; nothing ever deletes it, and re-issuing only re-ensures the same rows.

        await AuditAsync(
            actor,
            "case-study.report.reopened",
            entity,
            before: new { status = ReportStatusIssued },
            after: new
            {
                status = CaseStudyReportStatuses.Draft,
                reason,
                taskId,
                propertyId,
                poNumber = task.PoNumber,
                appraiserSubmitted,
                enfazHandoverCleared = handoverCleared,
            },
            cancellationToken);

        if (appraiserSubmitted)
            await NotifyAppraiserStudyReportReopenedAsync(entity, propertyId, reason, cancellationToken);

        return (new ReopenCaseStudyReportResultDto
        {
            Report = ToDto(entity),
            AppraiserSubmitted = appraiserSubmitted,
            EnfazHandoverCleared = handoverCleared,
        }, null);
    }

    /// <summary>
    /// Party contributions go back to «draft» only for children whose task is still open — a party
    /// that already completed stays locked until the specialist reopens that party on its own.
    /// </summary>
    private async Task UnlockOpenPartyContributionsAsync(
        Guid parentTaskId,
        DateTime now,
        CancellationToken cancellationToken)
    {
        var openChildIds = (await _db.ListChildTasksAsync(parentTaskId, cancellationToken))
            .Where(t => !t.IsTerminal)
            .Select(t => t.Id)
            .ToList();
        if (openChildIds.Count == 0) return;

        var contributions = await _db.ListPartyContributionsForUpdateAsync(openChildIds, cancellationToken);
        var changed = false;
        foreach (var contribution in contributions)
        {
            if (!IsIssuedStatus(contribution.Status)) continue;

            contribution.Status = CaseStudyReportStatuses.Draft;
            contribution.UpdatedAtUtc = now;
            changed = true;
        }

        if (changed)
            await _db.SaveChangesAsync(cancellationToken);
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

    private async Task<bool> HasActiveFailureAsync(
        WorkflowTask task,
        Guid? propertyId,
        CancellationToken cancellationToken)
    {
        if (_failureGate is null || propertyId is not Guid pid || pid == Guid.Empty) return false;
        return await _failureGate.HasBlockingFailureAsync(task.PoNumber, pid.ToString("D"), cancellationToken);
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
