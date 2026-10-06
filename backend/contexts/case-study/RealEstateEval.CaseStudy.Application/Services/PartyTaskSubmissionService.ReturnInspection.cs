using RealEstateEval.Application;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Application.Services;

/// <summary>
/// Batch 2C: return the inspector's package for correction AND decide, in one action, who else it affects —
/// the sibling appraiser / engineering office whose submitted packages go back to them (or only get a notice),
/// and what happens to an already issued case-study report. Works after acceptance too (the accept stamp is
/// cleared by the return).
/// <para>
/// Ordering (each step safe to retry): read-only validation → study-report reopen (its own transaction, which
/// also clears the shared change tracker, hence BEFORE any tracked entity is loaded) → ONE transaction that
/// returns the inspector's package and every affected submitted sibling and reopens their tasks → best-effort
/// notifications / timeline / audit. A reopened study with the inspection not yet returned is harmless and a
/// retry completes it; the reverse (issued report over a returned inspection) is never produced.
/// </para>
/// </summary>
public partial class PartyTaskSubmissionService
{
    public const string ReturnInspectionRoleDeniedAr = "ليس لديك صلاحية إعادة المعاينة للتصحيح";
    public const string ReturnInspectionKindAr = "إعادة المعاينة للتصحيح تخص مهام المعاينة الميدانية فقط";
    public const string StudyReportDecisionRequiredAr = "اختر إبقاء التقرير الصادر أو إعادة فتحه";
    public const string HandedOverToEnfazAr = "المعاملة سُلِّمت على إنفاذ — استخدم «إعادة من إنفاذ» أولاً";
    public const string ReturnReasonPrefixAr = "المعاينة أُعيدت للتصحيح — ";

    public const string StudyReportKeep = "keep";
    public const string StudyReportReopen = "reopen";

    public static class ReturnOutcomes
    {
        public const string Reopened = "reopened";
        public const string Notified = "notified";
        public const string Already = "already";
        public const string SkippedDeposited = "skipped_deposited";
        public const string SkippedNoAssignee = "skipped_no_assignee";
    }

    private const int MaxStudyReopenReasonLength = 1000;

    /// <summary>A sibling party of the inspection with its package, as the return decision sees it.</summary>
    private sealed record ReturnParty(WorkflowTask Task, PartyTaskSubmission? Submission)
    {
        public string PackageStatus => Submission?.Status ?? "none";
        public bool IsSubmitted => Submission?.Status == PartyTaskSubmissionStatus.Submitted;
        public bool IsAppraiser => Task.Kind == WorkflowTaskKind.PropertyAppraisal;
        public bool HasAssignee => !string.IsNullOrWhiteSpace(Task.AssigneeId);
    }

    // ---------------------------------------------------------------- impact (read)

    public async Task<(ReturnImpactDto? Result, Dictionary<string, string>? Errors)> GetReturnImpactAsync(
        Guid inspectionTaskId,
        IReadOnlyCollection<string>? sections,
        PartySubmissionActor actor,
        CancellationToken cancellationToken = default)
    {
        var task = await _repo.GetTaskAsync(inspectionTaskId, cancellationToken);
        if (task is null) return (null, null);
        if (task.Kind != WorkflowTaskKind.FieldInspection)
            return (null, Error(ReturnInspectionKindAr));
        if (!PoRoleMatrixRules.CanManagePartySubmissions(actor.PrototypeRole))
            return (null, Error(ReturnInspectionRoleDeniedAr));

        var groups = InspectorDataGroupRules.Resolve(sections, out var unknown);
        if (unknown.Count > 0)
            return (null, new Dictionary<string, string> { ["sections"] = $"قسم غير معروف: {unknown[0]}" });

        var parties = await LoadReturnPartiesAsync(task, cancellationToken);
        var deposited = await ValuationDepositedAsync(task, parties, cancellationToken);
        var studyIssued = task.ParentTaskId is Guid parentId
            && await _repo.IsCaseStudyReportIssuedAsync(parentId, cancellationToken);

        return (new ReturnImpactDto
        {
            Sections = groups
                .Select(g => new ReturnImpactSectionDto { Key = g.Key, LabelAr = g.LabelAr })
                .ToList(),
            Parties = parties
                .Select(p =>
                {
                    var because = InspectorDataGroupRules.SuggestedBecause(p.Task.Kind.ToDbValue(), groups);
                    return new ReturnImpactPartyDto
                    {
                        TaskId = p.Task.Id.ToString(),
                        Kind = p.Task.Kind.ToDbValue(),
                        AssigneeName = string.IsNullOrWhiteSpace(p.Task.AssigneeName) ? null : p.Task.AssigneeName,
                        PackageStatus = p.PackageStatus,
                        Suggested = because.Count > 0,
                        SuggestedBecause = because.ToList(),
                        WillBe = p.IsSubmitted && !(p.IsAppraiser && deposited) ? "reopen" : "notify",
                    };
                })
                .ToList(),
            StudyReportIssued = studyIssued,
            ValuationClosed = deposited,
        }, null);
    }

    // ---------------------------------------------------------------- return (write)

    public async Task<(ReturnInspectionResultDto? Result, Dictionary<string, string>? Errors)> ReturnInspectionAsync(
        Guid inspectionTaskId,
        ReturnInspectionRequest request,
        PartySubmissionActor actor,
        CancellationToken cancellationToken = default)
    {
        var task = await _repo.GetTaskAsync(inspectionTaskId, cancellationToken);
        if (task is null) return (null, Error("المهمة غير موجودة"));
        if (task.Kind != WorkflowTaskKind.FieldInspection) return (null, Error(ReturnInspectionKindAr));
        if (!PoRoleMatrixRules.CanManagePartySubmissions(actor.PrototypeRole))
            return (null, Error(ReturnInspectionRoleDeniedAr));

        var returnNote = request.ReturnNote?.Trim() ?? "";
        if (returnNote.Length == 0)
            return (null, new Dictionary<string, string> { ["returnNote"] = "ملاحظة الإرجاع مطلوبة" });

        var groups = InspectorDataGroupRules.Resolve(request.Sections, out var unknownSections);
        if (unknownSections.Count > 0)
            return (null, new Dictionary<string, string> { ["sections"] = $"قسم غير معروف: {unknownSections[0]}" });

        // ---- phase 1: read-only validation (nothing tracked yet)
        var inspection = await _repo.GetSubmissionAsync(inspectionTaskId, track: false, cancellationToken);
        if (inspection is null) return (null, Error("لا يوجد إرسال مُكتمل لإعادته"));

        if (task.PropertyId is Guid propertyId
            && await LoadSourcePropertyAsync(propertyId, cancellationToken) is { IsHandedOverToEnfaz: true })
        {
            return (null, Error(HandedOverToEnfazAr));
        }

        var actorUserId = actor.UserId?.Trim() ?? "";
        var replay = inspection.Status == PartyTaskSubmissionStatus.Reopened
            && actorUserId.Length > 0
            && string.Equals(inspection.ReopenedByUserId, actorUserId, StringComparison.Ordinal)
            && string.Equals(inspection.ReturnNote, returnNote, StringComparison.Ordinal);
        if (!replay && inspection.Status != PartyTaskSubmissionStatus.Submitted)
            return (null, Error("لا يوجد إرسال مُكتمل لإعادته"));
        var wasAccepted = inspection.AcceptedAtUtc is not null;

        var studyIssued = task.ParentTaskId is Guid parentTaskId
            && await _repo.IsCaseStudyReportIssuedAsync(parentTaskId, cancellationToken);
        var decision = request.StudyReport?.Trim().ToLowerInvariant();
        if (studyIssued && decision is not (StudyReportKeep or StudyReportReopen))
            return (null, new Dictionary<string, string> { ["studyReport"] = StudyReportDecisionRequiredAr });
        var reopenStudy = studyIssued && decision == StudyReportReopen;
        if (reopenStudy)
        {
            if (!PoRoleMatrixRules.CanReopenCaseStudyReport(actor.PrototypeRole))
                return (null, Error(CaseStudyReportService.ReopenRoleDeniedAr));
            if (_reports is null)
                return (null, Error("خدمة تقرير دراسة الحالة غير متاحة"));
        }

        var parties = await LoadReturnPartiesAsync(task, cancellationToken);
        if (!TryResolveAffected(request.AffectedTaskIds, parties, out var affected, out var affectedError))
            return (null, affectedError);
        var deposited = await ValuationDepositedAsync(task, affected, cancellationToken);

        var siblingReason = ReturnReasonPrefixAr + returnNote;
        var outcomes = affected
            .Select(p => (Party: p, Outcome: OutcomeFor(p, siblingReason, deposited)))
            .ToList();

        // ---- phase 2: the study report (own transaction; clears the shared tracker, so before tracking)
        var studyReopened = false;
        if (reopenStudy)
        {
            var reason = string.IsNullOrWhiteSpace(request.StudyReportReopenReason)
                ? siblingReason
                : request.StudyReportReopenReason.Trim();
            if (reason.Length > MaxStudyReopenReasonLength) reason = reason[..MaxStudyReopenReasonLength];

            var (reopened, reopenErrors) = await _reports!.ReopenAsync(
                task.ParentTaskId!.Value,
                reason,
                clearEnfazHandover: false,
                new CaseStudyReportActor
                {
                    UserId = actor.UserId,
                    DisplayName = actor.DisplayName,
                    PrototypeRole = actor.PrototypeRole,
                    DistributionAssigneeId = actor.DistributionAssigneeId,
                },
                cancellationToken);
            if (reopenErrors is not null) return (null, reopenErrors);
            if (reopened is null) return (null, Error("تقرير دراسة الحالة غير موجود"));
            studyReopened = true;
        }

        // ---- phase 3: ONE transaction — inspector + every reopened sibling, and their tasks
        var now = _time.UtcNow();
        var tracked = await _repo.GetSubmissionAsync(inspectionTaskId, track: true, cancellationToken);
        if (tracked is null) return (null, Error("لا يوجد إرسال مُكتمل لإعادته"));
        var taskIdsToReopen = new List<Guid>();

        if (!replay)
        {
            var returnError = tracked.ReturnForCorrection(returnNote, now, actor.UserId, actor.DisplayName);
            if (returnError is not null) return (null, Error(returnError));
            tracked.PayloadJson = PartyTaskSubmissionPayloadRules.SetPayloadReopened(tracked.PayloadJson, returnNote, now);
            await SyncFieldInspectionWorkspaceAsync(tracked, cancellationToken);
            taskIdsToReopen.Add(inspectionTaskId);
        }

        var finalOutcomes = new List<ReturnInspectionPartyOutcomeDto>();
        foreach (var (party, outcome) in outcomes)
        {
            if (outcome == ReturnOutcomes.Reopened)
            {
                var sibling = await _repo.GetSubmissionAsync(party.Task.Id, track: true, cancellationToken);
                if (sibling is null || sibling.ReturnForCorrection(
                        siblingReason, now, actor.UserId, actor.DisplayName) is not null)
                {
                    // The package moved since the read: treat as already handled, never fail the whole return.
                    finalOutcomes.Add(Outcome(party, ReturnOutcomes.Already));
                    continue;
                }

                sibling.PayloadJson = PartyTaskSubmissionPayloadRules.SetPayloadReopened(
                    sibling.PayloadJson, siblingReason, now);
                taskIdsToReopen.Add(party.Task.Id);
            }

            finalOutcomes.Add(Outcome(party, outcome));
        }

        await _repo.ExecuteInTransactionAsync(
            async ct =>
            {
                await _repo.SaveChangesAsync(ct);
                foreach (var id in taskIdsToReopen)
                {
                    await _tasks.PatchAsync(
                        id,
                        new PatchWorkflowTaskRequest
                        {
                            Status = WorkflowTaskStatusValues.Open,
                            Phase = WorkflowTaskPhaseValues.Done,
                        },
                        ct);
                }
            },
            cancellationToken);

        // ---- phase 4: best-effort side effects of the committed change
        await BestEffortAsync(() => AnnounceReturnAsync(
            task, tracked, replay, wasAccepted, returnNote, siblingReason, groups, affected,
            finalOutcomes, studyIssued, decision, studyReopened, actor, now, cancellationToken));

        return (new ReturnInspectionResultDto
        {
            Inspection = await ToDtoAsync(tracked, cancellationToken),
            Parties = finalOutcomes,
            StudyReport = new ReturnInspectionStudyReportDto { Issued = studyIssued, Reopened = studyReopened },
        }, null);
    }

    // ---------------------------------------------------------------- helpers

    private static ReturnInspectionPartyOutcomeDto Outcome(ReturnParty party, string outcome) => new()
    {
        TaskId = party.Task.Id.ToString(),
        Kind = party.Task.Kind.ToDbValue(),
        Outcome = outcome,
    };

    /// <summary>What the return does to one affected party, from the package it holds now.</summary>
    private static string OutcomeFor(ReturnParty party, string siblingReason, bool appraiserDeposited)
    {
        if (!party.HasAssignee) return ReturnOutcomes.SkippedNoAssignee;
        if (party.IsSubmitted)
            return party.IsAppraiser && appraiserDeposited ? ReturnOutcomes.SkippedDeposited : ReturnOutcomes.Reopened;
        return party.Submission is { Status: PartyTaskSubmissionStatus.Reopened } submission
            && string.Equals(submission.ReturnNote, siblingReason, StringComparison.Ordinal)
                ? ReturnOutcomes.Already
                : ReturnOutcomes.Notified;
    }

    /// <summary>
    /// The appraiser's package is submitted AND the property's valuation request is closed (deposited — no
    /// open request remains, the same fact the transaction state reads): that package is never reopened.
    /// </summary>
    private async Task<bool> ValuationDepositedAsync(
        WorkflowTask inspection,
        IReadOnlyList<ReturnParty> parties,
        CancellationToken cancellationToken)
    {
        if (_valuationRequests is null || inspection.PropertyId is not Guid propertyId) return false;
        if (!parties.Any(p => p.IsAppraiser && p.IsSubmitted)) return false;
        var open = await _valuationRequests.GetOpenByPropertyAsync(propertyId.ToString(), cancellationToken);
        // Closed (final issued) or frozen as the approved deposit copy: the package is not reopened underneath it.
        return open is null || string.Equals(open.ReportStage, ValuationReportStageWire.DepositIssued, StringComparison.Ordinal);
    }

    /// <summary>
    /// Sibling appraisal / survey tasks of the inspection (latest non-cancelled per kind) with their
    /// packages, read untracked — mutation re-loads the packages it changes.
    /// </summary>
    private async Task<IReadOnlyList<ReturnParty>> LoadReturnPartiesAsync(
        WorkflowTask inspection,
        CancellationToken cancellationToken)
    {
        if (inspection.ParentTaskId is not Guid parentId || inspection.PropertyId is not Guid propertyId)
            return [];

        var tasks = (await _repo.ListSiblingTasksAsync([parentId], [propertyId], cancellationToken))
            .Where(t => t.Kind is WorkflowTaskKind.PropertyAppraisal or WorkflowTaskKind.EngineeringSurvey
                && t.Status != WorkflowTaskStatus.Cancelled)
            .GroupBy(t => t.Kind)
            .Select(g => g.OrderByDescending(t => t.CreatedAtUtc).First())
            .OrderBy(t => t.Kind == WorkflowTaskKind.PropertyAppraisal ? 0 : 1)
            .ToList();
        if (tasks.Count == 0) return [];

        var submissions = (await _repo.ListSubmissionsAsync(tasks.Select(t => t.Id).ToList(), cancellationToken))
            .ToDictionary(s => s.WorkflowTaskId);
        return tasks.Select(t => new ReturnParty(t, submissions.GetValueOrDefault(t.Id))).ToList();
    }

    private static bool TryResolveAffected(
        IReadOnlyCollection<string>? requested,
        IReadOnlyList<ReturnParty> parties,
        out IReadOnlyList<ReturnParty> affected,
        out Dictionary<string, string>? error)
    {
        affected = [];
        error = null;
        var ids = new HashSet<Guid>();
        foreach (var raw in requested ?? [])
        {
            if (!Guid.TryParse(raw?.Trim(), out var id))
            {
                error = new Dictionary<string, string> { ["affectedTaskIds"] = "معرّف طرف غير صالح" };
                return false;
            }

            ids.Add(id);
        }

        if (ids.Any(id => parties.All(p => p.Task.Id != id)))
        {
            error = new Dictionary<string, string> { ["affectedTaskIds"] = "طرف غير تابع لهذه المعاينة" };
            return false;
        }

        affected = parties.Where(p => ids.Contains(p.Task.Id)).ToList();
        return true;
    }
}
