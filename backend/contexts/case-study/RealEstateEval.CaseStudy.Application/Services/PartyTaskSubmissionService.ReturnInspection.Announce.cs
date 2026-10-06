using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Application.Services;

/// <summary>
/// Side effects of a committed inspection return: one timeline row per affected party, the notices (new
/// source-event prefixes, deduped while unread), and the audit entry. Called best-effort after the commit.
/// </summary>
public partial class PartyTaskSubmissionService
{
    private async Task AnnounceReturnAsync(
        WorkflowTask inspectionTask,
        PartyTaskSubmission inspection,
        bool replay,
        bool wasAccepted,
        string returnNote,
        string siblingReason,
        IReadOnlyList<InspectorDataGroupRules.Group> sections,
        IReadOnlyList<ReturnParty> affected,
        IReadOnlyList<ReturnInspectionPartyOutcomeDto> outcomes,
        bool studyIssued,
        string? studyDecision,
        bool studyReopened,
        PartySubmissionActor actor,
        DateTime now,
        CancellationToken cancellationToken)
    {
        var outcomeByTask = outcomes.ToDictionary(o => o.TaskId, o => o.Outcome);

        // The inspector — the existing notice keeps its source event.
        if (!replay)
            await NotifyPartyReturnedForCorrectionAsync(inspectionTask, returnNote, cancellationToken);

        foreach (var party in affected)
        {
            var outcome = outcomeByTask.GetValueOrDefault(party.Task.Id.ToString(), "");
            await NotifyAffectedPartyAsync(inspectionTask, party, outcome, returnNote, siblingReason, cancellationToken);
        }

        if (studyReopened && inspectionTask.ParentTaskId is Guid parentTaskId)
            await NotifySpecialistStudyReopenedAsync(parentTaskId, returnNote, actor, cancellationToken);

        // Replays only re-send the (deduped) notices — the rows below were written by the first call.
        if (replay) return;

        if (inspectionTask.PropertyId is Guid propertyId)
        {
            var at = inspection.UpdatedAtUtc;
            var sectionText = sections.Count == 0
                ? returnNote
                : $"{returnNote} — الأقسام: {string.Join("، ", sections.Select(s => s.LabelAr))}";
            await _timeline.RecordAsync(
                inspectionTask.PoNumber,
                propertyId,
                $"party:{inspectionTask.Id}:returned:{at:O}",
                "إعادة المعاينة للتصحيح",
                sectionText,
                "warn",
                now,
                cancellationToken);

            foreach (var party in affected)
            {
                var outcome = outcomeByTask.GetValueOrDefault(party.Task.Id.ToString(), "");
                if (outcome is ReturnOutcomes.SkippedNoAssignee or ReturnOutcomes.Already) continue;
                await _timeline.RecordAsync(
                    inspectionTask.PoNumber,
                    propertyId,
                    $"party:{party.Task.Id}:inspection-returned:{at:O}",
                    TimelineTitleFor(party, outcome),
                    returnNote,
                    "warn",
                    now,
                    cancellationToken);
            }

            if (studyIssued && studyDecision == StudyReportKeep)
            {
                await _timeline.RecordAsync(
                    inspectionTask.PoNumber,
                    propertyId,
                    $"case-study-report:{inspectionTask.ParentTaskId}:kept-after-inspection-return:{at:O}",
                    "إبقاء تقرير دراسة الحالة الصادر بعد إعادة المعاينة",
                    returnNote,
                    "info",
                    now,
                    cancellationToken);
            }
        }

        await _auditLog.AppendAsync(_audit.Create(
            actorId: string.IsNullOrWhiteSpace(actor.UserId) ? "unknown" : actor.UserId,
            action: "case-study.party-submission.returned-with-impact",
            entityType: "PartyTaskSubmission",
            entityId: inspectionTask.Id.ToString("D"),
            before: new { status = "Submitted", accepted = wasAccepted },
            after: new
            {
                status = "Reopened",
                kind = inspectionTask.Kind.ToString(),
                poNumber = inspectionTask.PoNumber,
                returnNote,
                sections = sections.Select(s => s.Key).ToList(),
                affected = outcomes.Select(o => new { o.TaskId, o.Kind, o.Outcome }).ToList(),
                studyReport = new { issued = studyIssued, decision = studyDecision, reopened = studyReopened },
            }), cancellationToken);
    }

    private static string TimelineTitleFor(ReturnParty party, string outcome)
    {
        var who = party.IsAppraiser ? "المقيّم" : "المكتب الهندسي";
        return outcome == ReturnOutcomes.Reopened
            ? $"إعادة فتح عمل {who} بعد إعادة المعاينة"
            : $"تنبيه {who}: أُعيدت المعاينة للتصحيح";
    }

    private async Task NotifyAffectedPartyAsync(
        WorkflowTask inspectionTask,
        ReturnParty party,
        string outcome,
        string returnNote,
        string siblingReason,
        CancellationToken cancellationToken)
    {
        if (outcome is ReturnOutcomes.SkippedNoAssignee or ReturnOutcomes.Already or "") return;

        var task = party.Task;
        var id = Uri.EscapeDataString(task.Id.ToString());
        var refLabel = inspectionTask.PoNumber?.Trim();
        var suffix = string.IsNullOrEmpty(refLabel) ? "" : $" على {refLabel}";

        if (outcome == ReturnOutcomes.Reopened)
        {
            if (party.IsAppraiser)
            {
                await NotifyPartyAssigneeAsync(
                    task,
                    title: "أُعيد فتح تقييمك بعد إعادة المعاينة",
                    body: $"أُعيدت المعاينة للتصحيح{suffix} وأُعيد تقييمك للمراجعة: {returnNote}",
                    tone: "warn",
                    sourceEvent: $"inspection-returned-reopened-appraiser:{task.Id}",
                    href: $"/property-appraisal/{id}",
                    cancellationToken);
            }
            else
            {
                // The engineering office keeps the existing «returned for correction» notice.
                await NotifyPartyReturnedForCorrectionAsync(task, siblingReason, cancellationToken);
            }

            return;
        }

        // notified | skipped_deposited — a notice only.
        var deposited = outcome == ReturnOutcomes.SkippedDeposited;
        if (party.IsAppraiser)
        {
            await NotifyPartyAssigneeAsync(
                task,
                title: "أُعيدت المعاينة للتصحيح",
                body: deposited
                    ? $"أُعيدت المعاينة الميدانية للتصحيح{suffix}. التقييم مودَع ولن يُعاد فتحه: {returnNote}"
                    : $"أُعيدت المعاينة الميدانية للتصحيح{suffix}. راجع بيانات المعاينة عند عودتها: {returnNote}",
                tone: "warn",
                sourceEvent: $"inspection-returned-notified-appraiser:{task.Id}",
                href: $"/property-appraisal/{id}",
                cancellationToken);
        }
        else
        {
            await NotifyPartyAssigneeAsync(
                task,
                title: "أُعيدت المعاينة للتصحيح",
                body: $"أُعيدت المعاينة الميدانية للتصحيح{suffix}. راجع أثرها على الرفع المساحي: {returnNote}",
                tone: "warn",
                sourceEvent: $"inspection-returned-notified-office:{task.Id}",
                href: $"/active-survey/{id}",
                cancellationToken);
        }
    }

    /// <summary>The parent's case specialist is told the report was reopened on account of the return.</summary>
    private async Task NotifySpecialistStudyReopenedAsync(
        Guid parentTaskId,
        string returnNote,
        PartySubmissionActor actor,
        CancellationToken cancellationToken)
    {
        var parent = await _repo.GetTaskAsync(parentTaskId, cancellationToken);
        var assigneeId = parent?.AssigneeId?.Trim();
        if (parent is null || string.IsNullOrWhiteSpace(assigneeId)) return;

        var userId = await _recipients.ResolveUserIdForDistributionAssigneeAsync(assigneeId, cancellationToken);
        if (string.IsNullOrWhiteSpace(userId)
            || string.Equals(userId, actor.UserId?.Trim(), StringComparison.Ordinal))
            return;

        await _notifications.CreateForUserAsync(
            userId,
            new CreateUserNotificationRequest
            {
                Title = "أُعيد فتح تقرير دراسة الحالة",
                Body = $"أُعيد فتح تقرير دراسة الحالة بسبب إعادة المعاينة للتصحيح: {returnNote}",
                Tone = "warn",
                Href = $"/case-study/{Uri.EscapeDataString(parent.Id.ToString())}",
                Category = "workflow",
                EntityType = "task",
                EntityId = parent.Id.ToString(),
                SourceEvent = $"inspection-returned-study-reopened:{parent.Id}",
            },
            cancellationToken);
    }
}
