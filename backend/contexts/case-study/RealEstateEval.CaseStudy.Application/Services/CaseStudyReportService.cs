using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using System.Text.Json;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.CaseStudy.Application.Services;

public partial class CaseStudyReportService : ICaseStudyReportService
{
    private static readonly JsonSerializerOptions JsonOpts = JsonDefaults.CamelCase;

    private const WorkflowTaskKind CaseStudyPropertyKind = WorkflowTaskKind.CaseStudyProperty;
    private const string ReportStatusIssued = CaseStudyReportStatuses.Issued;

    /// <summary>The refusal an edit of an issued report gets — the only way back is the reopen action.</summary>
    public const string ReportIssuedReopenFirstAr = "التقرير صادر — أعد فتحه أولاً";

    private readonly ICaseStudyReportRepository _db;
    private readonly IWorkflowTaskService _workflowTasks;
    private readonly TimeProvider _time;
 /// <summary>Absent in test compositions that exercise form rules only.</summary>
    private readonly INotificationService? _notifications;
    private readonly INotificationRecipientResolver? _recipients;
    /// <summary>Absent in test compositions — the audit row and the explicit timeline entry are skipped.</summary>
    private readonly IAuditLogWriter? _audit;
    private readonly IAuditLogAppend? _auditLog;
    private readonly IPropertyTimelineService? _timeline;
    /// <summary>Absent in test compositions — the active-failure gate is skipped (the Blocked task status still refuses).</summary>
    private readonly ICaseStudyFailureGate? _failureGate;
    private readonly ICaseStudyInfoRolesLookup? _infoRoles;

    /// <param name="infoRoles">
    /// The info-roles matrix the 100% completeness rule reads. Production composition ALWAYS wires it
    /// (a DI-resolution test guarantees that): with a lookup present the rule FAILS CLOSED — an unreadable
    /// or empty matrix refuses the issue. ONLY a service constructed WITHOUT the lookup (unit-test
    /// compositions that exercise other rules) skips the completeness check.
    /// </param>
    public CaseStudyReportService(
        ICaseStudyReportRepository db,
        IWorkflowTaskService workflowTasks,
        TimeProvider? time = null,
        INotificationService? notifications = null,
        INotificationRecipientResolver? recipients = null,
        IAuditLogWriter? audit = null,
        IAuditLogAppend? auditLog = null,
        IPropertyTimelineService? timeline = null,
        ICaseStudyFailureGate? failureGate = null,
        ICaseStudyInfoRolesLookup? infoRoles = null)
    {
        _time = time ?? TimeProvider.System;
        _notifications = notifications;
        _recipients = recipients;
        _audit = audit;
        _auditLog = auditLog;
        _timeline = timeline;
        _failureGate = failureGate;
        _infoRoles = infoRoles;

        _db = db;
        _workflowTasks = workflowTasks;
    }

    /// <summary>True when this composition enforces the 100% completeness rule on issue (the lookup is wired).</summary>
    public bool EnforcesAnswerCompleteness => _infoRoles is not null;

    /// <summary>
    /// The one "is this report issued" predicate: issue gates, the post-issue lock and
    /// the party-form lock all use it, so none of them can disagree on the literal.
    /// </summary>
    internal static bool IsIssuedStatus(string? status) =>
        string.Equals(status?.Trim(), ReportStatusIssued, StringComparison.OrdinalIgnoreCase);

    /// <summary>
    /// A client may only save a report as new / draft / issued. Any other value would skip the
    /// issue gates and never lock the report, so it is rejected here (the DB CHECK allows the same three).
    /// «issued» stays accepted for ONE release so a not-yet-updated client (rolling deploy) can still
    /// <c>PUT</c> it — <see cref="SaveAsync"/> routes it into <see cref="IssueAsync"/>, the same core as
    /// <c>POST /{taskId}/issue</c>, so no gate is skipped. Drop it from this list once that release is out.
    /// </summary>
    internal static Dictionary<string, string>? ValidateClientStatus(string? status)
    {
        var normalized = NormalizeClientStatus(status);
        if (normalized is CaseStudyReportStatuses.New
            or CaseStudyReportStatuses.Draft
            or CaseStudyReportStatuses.Issued)
        {
            return null;
        }

        return new Dictionary<string, string>
        {
            ["_"] = "حالة التقرير غير مقبولة — المسموح مسودة أو صادر فقط",
        };
    }

    private static string NormalizeClientStatus(string? status) =>
        (status ?? "").Trim().ToLowerInvariant();

    public async Task<CaseStudyReportDto?> GetAsync(
        Guid taskId,
        bool party,
        CaseStudyReportActor? actor = null,
        CancellationToken cancellationToken = default)
    {
        if (actor is not null && !await CanReadFormAsync(taskId, actor, cancellationToken))
            return null;

        var entity = await _db.GetFormAsync(taskId, party, track: false, cancellationToken);
        if (entity is not null)
            return ToDto(entity);

        var task = await _db.GetTaskAsync(taskId, cancellationToken);
        return task is null ? null : EmptyDto(task);
    }

 /// <summary>
 /// Case staff read every form. A party reads a form when assigned to the task itself or to
 /// one of its child tasks — the party workspace seeds itself from the parent case-study form.
 /// </summary>
    private async Task<bool> CanReadFormAsync(
        Guid taskId,
        CaseStudyReportActor actor,
        CancellationToken cancellationToken)
    {
        if (PoRoleMatrixRules.CanManagePartySubmissions(actor.PrototypeRole)) return true;

        var assigneeIds = await _db.ListTaskAndChildAssigneeIdsAsync(taskId, cancellationToken);

        return CaseStudyReportReadRules.CanRead(actor, assigneeIds);
    }

    public async Task<(CaseStudyReportDto? Result, Dictionary<string, string>? Errors)> SaveAsync(
        Guid taskId,
        bool party,
        CaseStudyReportDto form,
        CaseStudyReportActor? actor = null,
        CancellationToken cancellationToken = default)
    {
        var matchErrors = CaseStudyReportDeedNatureMatchRules.ValidateForSave(
            form.DeedNatureMatchOutcome,
            form.DeedNatureMatchNotes);
        if (matchErrors is not null)
            return (null, matchErrors);

        var statusErrors = ValidateClientStatus(form.Status);
        if (statusErrors is not null)
            return (null, statusErrors);

        // Compat route (one release): a PUT that issues goes through the very same core as
        // POST /{taskId}/issue — role, failure, deed-nature, 100% — then ONE transaction. An already
        // issued report keeps falling through to the «reopen first» refusal below.
        if (!party && IsIssuedStatus(form.Status))
        {
            var current = await _db.GetFormAsync(taskId, party: false, track: false, cancellationToken);
            if (current is null || !IsIssuedStatus(current.Status))
            {
                var (issued, issueErrors) = await IssueAsync(taskId, form, actor, cancellationToken);
                if (issueErrors is not null) return (null, issueErrors);
                return issued is null
                    ? (null, new Dictionary<string, string> { ["_"] = "المهمة غير موجودة" })
                    : (issued, null);
            }
        }

 // Autosave / multi-tab can race on xmin — retry with a fresh load instead of 409 noise.
        const int maxAttempts = 3;
        for (var attempt = 1; attempt <= maxAttempts; attempt++)
        {
            try
            {
                return await SaveOnceAsync(
                    taskId,
                    party,
                    form,
                    actor,
                    cancellationToken);
            }
            catch (PersistenceConcurrencyException) when (attempt < maxAttempts)
            {
                _db.DiscardTrackedChanges();
            }
            catch (PersistenceConcurrencyException)
            {
                _db.DiscardTrackedChanges();
                return (null, new Dictionary<string, string>
                {
                    ["_"] =
                        "تم تحديث النموذج من جلسة أخرى. أعد المحاولة — إن استمر الأمر حدّث الصفحة ثم احفظ.",
                });
            }
        }

        return (null, new Dictionary<string, string>
        {
            ["_"] =
                "تم تحديث النموذج من جلسة أخرى. أعد المحاولة — إن استمر الأمر حدّث الصفحة ثم احفظ.",
        });
    }

    private async Task<(CaseStudyReportDto? Result, Dictionary<string, string>? Errors)> SaveOnceAsync(
        Guid taskId,
        bool party,
        CaseStudyReportDto form,
        CaseStudyReportActor? actor,
        CancellationToken cancellationToken)
    {
        var entity = await _db.GetFormAsync(taskId, party, track: true, cancellationToken);

        if (party)
        {
            var partyErrors = await ValidatePartySaveAllowedAsync(
                taskId,
                entity,
                actor,
                cancellationToken);
            if (partyErrors is not null)
                return (null, partyErrors);
        }
        else if (entity is not null && IsIssuedStatus(entity.Status))
        {
            return (null, new Dictionary<string, string>
            {
                ["_"] = ReportIssuedReopenFirstAr,
            });
        }
        else if (!party && actor is not null
                 && !PoRoleMatrixRules.CanEditProperty(actor.PrototypeRole)
                 && !PoRoleMatrixRules.CanManagePartySubmissions(actor.PrototypeRole))
        {
            return (null, new Dictionary<string, string>
            {
                ["_"] = "ليس لديك صلاحية تعديل تقرير دراسة الحالة",
            });
        }

        // Defensive: SaveAsync routes every non-party «issued» save into IssueAsync, so this is only
        // reachable by a race — never persist «issued» without the issue gates.
        if (!party && IsIssuedStatus(form.Status))
        {
            return (null, new Dictionary<string, string>
            {
                ["_"] = "إصدار تقرير دراسة الحالة يتم بزر «إصدار تقرير دراسة الحالة» — أعد المحاولة",
            });
        }

        var previousMatchOutcome = (entity?.DeedNatureMatchOutcome ?? "").Trim();
        var previousAnswers = ParseAnswers(entity?.AnswersJson);
        var previousRemarks = ReadRemarkMap(entity);
        var previousProvenance = CaseStudyAnswerProvenance.Parse(entity?.AnswerProvenanceJson);
        var now = _time.UtcNow();
        if (entity is null)
        {
            entity = new CaseStudyReport
            {
                Id = Guid.NewGuid(),
                TaskId = taskId,
                IsPartyContribution = party,
                CreatedAtUtc = now,
            };
            _db.AddForm(entity);
        }

        ApplyDto(entity, form, now);

        // No linked-comparables gate here: comparables belong to the valuation (its issuance
        // gates demand them), not to the case study.

        if (actor is not null)
        {
            await StampProvenanceAsync(
                entity, form, previousAnswers, previousRemarks, previousProvenance,
                actor, taskId, now, cancellationToken);
        }

        await _db.SaveChangesAsync(cancellationToken);

        if (!party)
        {
            await NotifyAppraiserOnMatchOutcomeAsync(
                taskId,
                entity,
                previousMatchOutcome,
                cancellationToken);
        }

        return (ToDto(entity), null);
    }

    private async Task<Dictionary<string, string>?> ValidatePartySaveAllowedAsync(
        Guid partyTaskId,
        CaseStudyReport? existingEntity,
        CaseStudyReportActor? actor,
        CancellationToken cancellationToken)
    {
        if (existingEntity is not null && IsIssuedStatus(existingEntity.Status))
        {
            return new Dictionary<string, string>
            {
                ["_"] = "تم إغلاق مساهمة الطرف بعد إصدار تقرير دراسة الحالة",
            };
        }

        var task = await _db.GetTaskAsync(partyTaskId, cancellationToken);

        if (actor is not null
            && !PoRoleMatrixRules.CanWritePartyTask(
                actor.PrototypeRole,
                task?.AssigneeId,
                actor.UserId,
                actor.DistributionAssigneeId))
        {
            return new Dictionary<string, string>
            {
                ["_"] = "ليس لديك صلاحية تعديل إجابات هذه المهمة",
            };
        }

        if (task?.ParentTaskId is not Guid parentId)
            return null;

        var parentIssued = await _db.CaseStudyReportHasStatusAsync(
            parentId,
            ReportStatusIssued,
            cancellationToken);
        if (!parentIssued)
            return null;

        return new Dictionary<string, string>
        {
            ["_"] = "تم إصدار تقرير دراسة الحالة — لا يمكن تعديل إجابات الأطراف",
        };
    }

    private async Task LockPartyContributionsAsync(
        Guid parentTaskId,
        DateTime now,
        CancellationToken cancellationToken)
    {
        var childTaskIds = await _db.ListChildTaskIdsAsync(parentTaskId, cancellationToken);
        if (childTaskIds.Count == 0)
            return;

        var partyContributions = await _db.ListPartyContributionsForUpdateAsync(childTaskIds, cancellationToken);

        var changed = false;
        foreach (var partyContribution in partyContributions)
        {
            if (IsIssuedStatus(partyContribution.Status))
                continue;

            partyContribution.Status = ReportStatusIssued;
            partyContribution.UpdatedAtUtc = now;
            changed = true;
        }

        if (changed)
            await _db.SaveChangesAsync(cancellationToken);
    }

    private async Task TryCompleteCaseStudyWorkflowTaskAsync(
        Guid taskId,
        CancellationToken cancellationToken)
    {
        var task = await _db.GetTaskAsync(taskId, cancellationToken);
        if (task is null || task.Kind != CaseStudyPropertyKind || task.IsTerminal)
        {
            return;
        }

        await _workflowTasks.PatchAsync(
            taskId,
            new PatchWorkflowTaskRequest
            {
                Status = WorkflowTaskStatusValues.Completed,
                Phase = WorkflowTaskPhaseValues.Done,
            },
            cancellationToken);
    }

    private static void ApplyDto(
        CaseStudyReport entity,
        CaseStudyReportDto dto,
        DateTime now,
        string? statusOverride = null)
    {
        entity.PropertyId = Guid.TryParse(dto.PropertyId, out var pid) ? pid : null;
        entity.PoNumber = dto.PoNumber;
        // Already validated in SaveAsync (ValidateClientStatus) — stored canonical.
        entity.Status = statusOverride ?? NormalizeClientStatus(dto.Status);
        entity.CurrentStep = dto.CurrentStep;
        entity.RequestNumber = dto.RequestNumber ?? "";
        entity.RequestDate = dto.RequestDate ?? "";
        entity.DeedNumber = dto.DeedNumber ?? "";
        entity.AnswersJson = JsonSerializer.Serialize(dto.Answers ?? new(), JsonOpts);
        entity.DeedRemarks = dto.DeedRemarks ?? "";
        entity.SurveyRemarks = dto.SurveyRemarks ?? "";
        entity.ComponentsRemarks = dto.ComponentsRemarks ?? "";
        entity.OccupancyRemarks = dto.OccupancyRemarks ?? "";
        entity.MeterType = dto.MeterType ?? "";
        entity.MeterNumber = dto.MeterNumber ?? "";
        entity.HoaFee = dto.HoaFee ?? "";
        entity.SigDeed = dto.SigDeed ?? "";
        entity.SigApprover = dto.SigApprover ?? "";
        entity.SigDate = dto.SigDate ?? "";
        entity.SpecialistReviewApprovedJson = dto.SpecialistReviewApproved is null
            ? null
            : JsonSerializer.Serialize(dto.SpecialistReviewApproved, JsonOpts);
        entity.InfathLinkedAssets = dto.InfathLinkedAssets ?? "";
        entity.InfathLinkedDeedNumbers = dto.InfathLinkedDeedNumbers ?? "";
        entity.InfathLinkedAssetsNotes = dto.InfathLinkedAssetsNotes ?? "";
        entity.InfathOtherNotes = dto.InfathOtherNotes ?? "";
        entity.InfathClosingNotes = dto.InfathClosingNotes ?? "";
 // Validated in SaveAsync — normalized here.
        entity.DeedNatureMatchOutcome = (dto.DeedNatureMatchOutcome ?? "").Trim().ToLowerInvariant();
        entity.DeedNatureMatchNotes = dto.DeedNatureMatchNotes ?? "";
        entity.SavedAtUtc = now;
        entity.UpdatedAtUtc = now;
    }

    // Projection lives in CaseStudyReportMapping so the batch read returns the same shape.
    private static CaseStudyReportDto EmptyDto(WorkflowTask task) => CaseStudyReportMapping.EmptyDto(task);

    private static CaseStudyReportDto ToDto(CaseStudyReport entity) => CaseStudyReportMapping.ToDto(entity);
}