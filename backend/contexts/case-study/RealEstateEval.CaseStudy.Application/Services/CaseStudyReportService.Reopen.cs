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
/// Reopening the issued case-study report — split from <c>CaseStudyReportService.Issue.cs</c> by concern
/// (2026-10-26) so each partial stays under the application-service size cap.
/// </summary>
public partial class CaseStudyReportService
{
    // --------------------------------------------------------------- reopen

    /// <summary>Reopens the issued case-study report (the transaction's one study) — case specialist only.</summary>
    /// <remarks>
    /// How it works: refuses an actor of another role, re-points the task id to the holder deed's parent task
    /// (phase 4), then runs <see cref="ReopenOnceAsync"/> with the same three-attempt xmin retry as issue.
    /// Edge cases: reopening from a folded deed reopens the holder's study, never a second one.
    /// </remarks>
    public async Task<(ReopenCaseStudyReportResultDto? Result, Dictionary<string, string>? Errors)> ReopenAsync(
        Guid taskId,
        string? reason,
        bool clearEnfazHandover,
        CaseStudyReportActor? actor = null,
        CancellationToken cancellationToken = default)
    {
        if (actor is not null && !PoRoleMatrixRules.CanReopenCaseStudyReport(actor.PrototypeRole))
            return (null, Fail(ReopenRoleDeniedAr));

        // Phase 4: reopening the transaction's one study, from whichever deed asked.
        taskId = await _db.ResolveStudyTaskIdAsync(taskId, cancellationToken);

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

    /// <summary>One reopen attempt: back to draft for every deed of the transaction.</summary>
    /// <remarks>
    /// How it works: 1) reason of 10–1000 characters; 2) the report must be issued; 3) lists every
    /// deed's parent task and every deed of the transaction (the lone deed when none); 4) refuses
    /// when any deed is marked ready for billing, and asks for confirmation when any deed is handed
    /// over to Enfaz; 5) in ONE transaction: report → draft, every deed's handover stamp cleared (when
    /// confirmed), then for every deed's parent: Completed → Open in the case-study phase, unlock of
    /// open party contributions, «إعادة فتح» on the deed's timeline; 6) audit, appraiser notice.
    /// Edge cases: any deed of the transaction handed over freezes the one study (phase 4); the deeds
    /// are re-read tracked inside the transaction because the tracker is cleared on each run.
    /// KNOWN GAP (not fixed): only the child tasks open at this moment get their contributions
    /// unlocked, so an inspection returned after the reopen keeps the inspector's case-study answers
    /// locked.
    /// </remarks>
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
        // confirms taking it back (which clears the handover stamp). Phase 4: any deed of the
        // transaction handed over freezes the one study.
        var propertyId = existing.PropertyId ?? task.PropertyId;
        var parents = await _db.ListTransactionParentTasksAsync(taskId, cancellationToken);
        if (parents.Count == 0) parents = [task];
        var transactionDeeds = await _db.ListTransactionPropertiesForUpdateAsync(taskId, cancellationToken);
        if (transactionDeeds.Count == 0 && propertyId is Guid lonePropertyId && lonePropertyId != Guid.Empty)
        {
            var lone = await _db.GetPropertyForUpdateAsync(lonePropertyId, cancellationToken);
            if (lone is not null) transactionDeeds = [lone];
        }
        // Billing-ready guard (details on BillingReadyBlocksReopenAr): any marked deed refuses the reopen,
        // before the stamp-confirmation prompt, because the reopen below clears every deed's stamp.
        if (transactionDeeds.Any(p => p.IsBillingReady))
            return (null, Fail(BillingReadyBlocksReopenAr));
        var handedOver = transactionDeeds.Any(p => p.IsHandedOverToEnfaz);
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

                if (handedOver)
                {
                    // The tracker was cleared above: re-read the deeds tracked and clear every stamp.
                    var deeds = await _db.ListTransactionPropertiesForUpdateAsync(taskId, ct);
                    if (deeds.Count == 0 && propertyId is Guid clearPropertyId)
                    {
                        var lone = await _db.GetPropertyForUpdateAsync(clearPropertyId, ct);
                        if (lone is not null) deeds = [lone];
                    }
                    foreach (var deed in deeds)
                    {
                        if (deed.ClearEnfazHandover()) handoverCleared = true;
                    }
                }

                await _db.SaveChangesAsync(ct);

                // Every deed's parent: Completed → Open, back in the case-study phase. The domain
                // Reopen sets the phase, the shell patch does not — so both fields are sent.
                foreach (var parent in parents)
                {
                    if (parent.Status == WorkflowTaskStatus.Completed)
                    {
                        await _workflowTasks.PatchAsync(
                            parent.Id,
                            new PatchWorkflowTaskRequest
                            {
                                Status = WorkflowTaskStatusValues.Open,
                                Phase = WorkflowTaskPhaseValues.CaseStudy,
                            },
                            ct);
                    }

                    await UnlockOpenPartyContributionsAsync(parent.Id, now, ct);

                    var timelinePropertyId = parent.Id == task.Id ? propertyId : parent.PropertyId;
                    if (_timeline is not null && timelinePropertyId is Guid timelineId)
                    {
                        await _timeline.RecordAsync(
                            parent.PoNumber,
                            timelineId,
                            $"case-study-report:{taskId}:reopened:{now:O}",
                            "إعادة فتح تقرير دراسة الحالة",
                            string.IsNullOrWhiteSpace(actor?.DisplayName) ? reason : $"{actor.DisplayName.Trim()} — {reason}",
                            PropertyTimelineTones.Warn,
                            now,
                            ct);
                    }
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
}
