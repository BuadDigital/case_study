using RealEstateEval.Application;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Mapping;
using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Domain;

namespace RealEstateEval.CaseStudy.Application.Services;

public sealed partial class PartyTaskSubmissionService
{
    /// <summary>The study issue refusal while the corrected type needs a survey nobody was given.</summary>
    /// <summary>
    /// The inspector corrected the bourse type on site (2026-10-29 ruling).
    /// How it works: records the change on the property timeline (the «الجدول الزمني» card and the
    /// «السجل والتدقيق» tab read it) and in the system audit log; then follows the survey rule of the
    /// new type — a survey it needs that nobody was given is asked of the case specialist (he adds the
    /// office), and a survey it no longer needs is withdrawn at once, the office not told.
    /// Edge cases: a survey already completed stays — done work and its fee are not undone. A survey
    /// added by exception to a property the rule never asked one for stays too (2026-11-11). No reason
    /// and no specialist approval are asked for the change itself. The ask never blocks issuing the
    /// study (Omar 2026-11-04); the office is added from «مهمة جديدة», type «رفع مساحي» (Omar 2026-11-11 —
    /// the note that sat in the inspector's section is gone). <paramref name="staffReason"/> set = case
    /// staff changed the type after the inspection was sent (Omar 2026-11-12): the timeline row says so
    /// and carries the reason, the audit row stores it, and a missing name reads «الأخصائي» — never the
    /// inspector's name.
    /// </summary>
    private async Task OnInspectedTypeChangedAsync(
        WorkflowTask inspectionTask,
        InspectedTypeChange change,
        PartySubmissionActor? actor,
        DateTime now,
        CancellationToken cancellationToken,
        string? staffReason = null)
    {
        if (inspectionTask.PropertyId is not Guid propertyId) return;

        var byStaff = staffReason is not null;
        var by = actor?.DisplayName?.Trim() is { Length: > 0 } name
            ? name
            : byStaff ? "الأخصائي" : inspectionTask.AssigneeName;
        var from = change.PreviousType.Length > 0 ? change.PreviousType : "—";
        await _timeline.RecordAsync(
            inspectionTask.PoNumber,
            propertyId,
            $"inspected-type:{inspectionTask.Id}:{now.Ticks}",
            byStaff ? "تعديل نوع العقار من الأخصائي" : "تغيير نوع العقار ميدانياً",
            byStaff
                ? $"من «{from}» إلى «{change.NewType}» — {by} — السبب: {staffReason}"
                : $"من «{from}» إلى «{change.NewType}» — {by}",
            PropertyTimelineTones.Warn,
            now,
            cancellationToken);
        var before = new
        {
            propertyType = change.PreviousType,
            classification = PropertyTypeCatalog.ClassificationOf(change.PreviousType),
        };
        var actorId = string.IsNullOrWhiteSpace(actor?.UserId) ? "unknown" : actor.UserId;
        await _auditLog.AppendAsync(
            byStaff
                ? _audit.Create(
                    actorId: actorId,
                    action: "case-study.property.inspected-type-changed",
                    entityType: "WorkOrderProperty",
                    entityId: propertyId.ToString("D"),
                    before: before,
                    after: new
                    {
                        propertyType = change.NewType,
                        classification = PropertyTypeCatalog.ClassificationOf(change.NewType),
                        poNumber = inspectionTask.PoNumber,
                        changedBy = "staff",
                        reason = staffReason,
                    })
                : _audit.Create(
                    actorId: actorId,
                    action: "case-study.property.inspected-type-changed",
                    entityType: "WorkOrderProperty",
                    entityId: propertyId.ToString("D"),
                    before: before,
                    after: new
                    {
                        propertyType = change.NewType,
                        classification = PropertyTypeCatalog.ClassificationOf(change.NewType),
                        poNumber = inspectionTask.PoNumber,
                    }),
            cancellationToken);

        var survey = await FindSiblingAsync(inspectionTask, WorkflowTaskKind.EngineeringSurvey, cancellationToken);
        var surveyLive = survey is not null && survey.Status != WorkflowTaskStatus.Cancelled;
        // SurveyRequirementRules.SurveyMissingAfterTypeChange: asked only while the type differs from the
        // bourse type. Adding the office itself («مهمة جديدة» → «رفع مساحي») does not wait for a change.
        if (change.SurveyRequiredAfter && change.DiffersFromBourseType && !surveyLive)
            await AskSpecialistForSurveyAsync(inspectionTask, propertyId, change, now, byStaff, cancellationToken);
        else if (change.WithdrawsSurvey && survey is not null && !survey.IsTerminal)
            await WithdrawSurveyAsync(inspectionTask, survey, propertyId, change, actor, now, cancellationToken);
    }

    /// <summary>
    /// Case staff correct the type and / or usage of a submitted inspection (Omar 2026-11-12: the study
    /// specialist changes the property type too — until then only the inspector could, by a return).
    /// </summary>
    /// <remarks>
    /// How it works: only a field inspection, by whoever may correct the inspector's package
    /// (<see cref="PartyTaskSubmissionRules.StaffMayCorrectPartyPackage"/>), on a package that is
    /// submitted — accepted or not — and until review approves the study (the lock of every other
    /// property field) or the transaction is delivered to Enfaz. A new type must be on the system's
    /// list and carry a reason of 10 characters;
    /// a new usage needs none (as in the review). The payload, the workspace row, the property's
    /// inspected type / usage and the field provenance are saved together; then the timeline and
    /// audit rows, the survey rule of the new type (ask for the office / withdraw the open survey)
    /// and the appraiser's «inspection data changed» alert follow, as after the inspector's own change.
    /// Edge cases: nothing new in the request is a no-op that returns the package as it is; a package
    /// returned to the inspector is refused (his next submit decides the type); a change to land keeps
    /// the building answers in the payload (<see cref="InspectedPropertyTypeRules.ApplyStaffCorrection"/>).
    /// </remarks>
    public async Task<(PartyTaskSubmissionDto? Result, Dictionary<string, string>? Errors)> CorrectInspectedTypeAsync(
        Guid taskId,
        CorrectInspectedTypeRequest request,
        PartySubmissionActor actor,
        CancellationToken cancellationToken = default)
    {
        var task = await _repo.GetTaskAsync(taskId, cancellationToken);
        if (task is null)
            return (null, Error("المهمة غير موجودة"));
        if (task.Kind != WorkflowTaskKind.FieldInspection || task.PropertyId is not Guid propertyId)
            return (null, Error("تعديل نوع العقار متاح لمهمة المعاينة فقط"));
        if (!PartyTaskSubmissionRules.StaffMayCorrectPartyPackage(actor, task))
            return (null, Error("ليس لديك صلاحية تعديل نوع العقار"));
        if (await IsTransactionCancelledAsync(task, cancellationToken))
            return (null, Error(TransactionCancelledAr));
        // Delivered to Enfaz: frozen until the specialist takes the transaction back — also for a
        // transaction older than the review stamp (found on the first live run, PO-AZ-2026-220).
        if (await IsHandedOverToEnfazAsync(task, cancellationToken))
            return (null, Error(HandedOverToEnfazAr));
        if (await _repo.IsTransactionReviewApprovedAsync(propertyId, cancellationToken))
            return (null, Error(WorkOrderPropertyWriteRules.ReviewApprovedLockAr));

        var entity = await _repo.GetSubmissionAsync(taskId, track: true, cancellationToken);
        if (entity is null || entity.Status is not PartyTaskSubmissionStatus.Submitted)
            return (null, Error("يُعدَّل نوع العقار واستخدامه بعد أن يرسل المعاين معاينته"));

        var requestedType = (request.PropertyType ?? "").Trim();
        var typeChanges = requestedType.Length > 0
            && !string.Equals(
                requestedType,
                InspectedPropertyTypeRules.FromPayload(entity.PayloadJson),
                StringComparison.Ordinal);
        var requestedUsage = (request.PropertyUsage ?? "").Trim();
        var usageBefore = InspectedUsageRules.FromPayload(entity.PayloadJson);
        var usageChanges = requestedUsage.Length > 0
            && !string.Equals(requestedUsage, usageBefore, StringComparison.Ordinal);

        var errors = new Dictionary<string, string>();
        string? reason = null;
        if (typeChanges)
        {
            if (!PropertyTypeCatalog.IsInspectorValue(requestedType))
                errors["propertyType"] = InspectedPropertyTypeRules.StaffChangeTypeInvalidAr;
            reason = InspectedPropertyTypeRules.StaffChangeReason(request.Reason);
            if (reason is null)
                errors["reason"] = InspectedPropertyTypeRules.StaffChangeReasonRequiredAr;
        }
        if (usageChanges
            && (requestedUsage.Length > InspectedUsageRules.MaxLength
                || PropertyTypeCatalog.IsClassification(requestedUsage)))
        {
            errors["propertyUsage"] = "اكتب استخدام العقار (سكني، تجاري…) لا تصنيفه";
        }
        if (errors.Count > 0) return (null, errors);
        if (!typeChanges && !usageChanges)
            return (await ToDtoAsync(entity, cancellationToken), null);

        var now = _time.UtcNow();
        var payloadBefore = entity.PayloadJson;
        var payloadJson = InspectedPropertyTypeRules.ApplyStaffCorrection(
            payloadBefore,
            typeChanges ? requestedType : null,
            usageChanges ? requestedUsage : null);
        var provenance = PartyFieldProvenance.Stamp(
            entity.FieldProvenanceJson, payloadBefore, payloadJson, actor, now);
        var correctError = entity.CorrectSubmittedPayload(payloadJson, now);
        if (correctError is not null) return (null, Error(correctError));
        entity.FieldProvenanceJson = provenance;

        await SyncFieldInspectionWorkspaceAsync(entity, cancellationToken);
        InspectedTypeChange? typeChange = null;
        if (typeChanges)
            typeChange = await _repo.SetInspectedPropertyTypeAsync(propertyId, requestedType, cancellationToken);
        if (usageChanges)
            await _repo.SetInspectedUsageAsync(propertyId, requestedUsage, cancellationToken);
        await _repo.SaveChangesAsync(cancellationToken);

        if (usageChanges)
        {
            await RecordUsageNameAsync(requestedUsage, actor, cancellationToken);
            await _timeline.RecordAsync(
                task.PoNumber,
                propertyId,
                $"inspected-usage:{taskId}:{now.Ticks}",
                "تعديل استخدام العقار من الأخصائي",
                $"من «{(string.IsNullOrEmpty(usageBefore) ? "—" : usageBefore)}» إلى «{requestedUsage}»"
                    + (actor.DisplayName?.Trim() is { Length: > 0 } usageBy ? $" — {usageBy}" : ""),
                PropertyTimelineTones.Warn,
                now,
                cancellationToken);
        }
        if (typeChange is not null)
            await OnInspectedTypeChangedAsync(task, typeChange, actor, now, cancellationToken, reason);

        await AlertAppraiserInspectorDataChangedAsync(
            task, payloadBefore, entity.PayloadJson, entity.AcceptedAtUtc is not null, cancellationToken);
        return (await ToDtoAsync(entity, cancellationToken), null);
    }

    /// <summary>
    /// The new type needs a survey that was never distributed: the case specialist adds the office.
    /// <paramref name="byStaff"/>: the notice does not name the inspector when case staff made the change.
    /// </summary>
    private async Task AskSpecialistForSurveyAsync(
        WorkflowTask inspectionTask,
        Guid propertyId,
        InspectedTypeChange change,
        DateTime now,
        bool byStaff,
        CancellationToken cancellationToken)
    {
        await _timeline.RecordAsync(
            inspectionTask.PoNumber,
            propertyId,
            $"inspected-type:{inspectionTask.Id}:survey-needed:{now.Ticks}",
            "يلزم رفع مساحي",
            $"النوع الجديد «{change.NewType}» يحتاج رفعاً مساحياً — بانتظار إضافة المكتب الهندسي",
            PropertyTimelineTones.Warn,
            now,
            cancellationToken);

        if (inspectionTask.ParentTaskId is not Guid parentId) return;
        var parent = await _repo.GetTaskAsync(parentId, cancellationToken);
        var specialistId = parent?.AssigneeId?.Trim();
        if (string.IsNullOrWhiteSpace(specialistId)) return;
        var userId = await _recipients.ResolveUserIdForDistributionAssigneeAsync(specialistId, cancellationToken);
        if (string.IsNullOrWhiteSpace(userId)) return;

        var refLabel = inspectionTask.PoNumber?.Trim();
        // The office is added from «مهمة جديدة», type «رفع مساحي» (Omar 2026-11-11) — the link opens
        // that form on the work order; without a work-order number it opens the transaction.
        await _notifications.CreateForUsersAsync(
            [userId],
            new CreateUserNotificationRequest
            {
                Title = "يلزم رفع مساحي",
                Body = $"{(byStaff ? "عُدِّل نوع العقار" : "غيّر المعاين نوع العقار")} إلى «{change.NewType}»{(string.IsNullOrEmpty(refLabel) ? "" : $" على {refLabel}")} — "
                    + "النوع الجديد يحتاج رفعاً مساحياً. أضف المكتب الهندسي من «المهام»: مهمة جديدة، النوع «رفع مساحي».",
                Tone = "warn",
                Href = string.IsNullOrEmpty(refLabel)
                    ? $"/case-study/{Uri.EscapeDataString(parentId.ToString())}"
                    : $"/operations-tasks?create=1&type=engineering_survey&po={Uri.EscapeDataString(refLabel)}",
                Category = "workflow",
                EntityType = "task",
                EntityId = parentId.ToString(),
                SourceEvent = $"inspected-type-survey-needed:{inspectionTask.Id}:{now.Ticks}",
            },
            cancellationToken);
    }

    /// <summary>
    /// The study's distribution no longer names the engineering office — the parties rail, the study queue's
    /// office column and the deed-match context read the distribution, and kept showing the withdrawn office
    /// «قيد التنفيذ» (A→Z test 2026-10-29).
    /// </summary>
    private async Task ClearOfficeFromDistributionAsync(WorkflowTask inspectionTask, CancellationToken cancellationToken)
    {
        if (inspectionTask.ParentTaskId is not Guid parentId) return;
        var parent = await _repo.GetTaskAsync(parentId, cancellationToken);
        var distribution = WorkflowTaskMapper.DeserializeDistribution(parent?.DistributionJson);
        if (distribution is null || (!distribution.EngineeringOffice && string.IsNullOrEmpty(distribution.EngineeringOfficeId)))
            return;
        distribution.EngineeringOffice = false;
        distribution.EngineeringOfficeId = "";
        await _tasks.PatchAsync(parentId, new PatchWorkflowTaskRequest { Distribution = distribution }, cancellationToken);
    }

    /// <summary>The new type needs no survey: the open survey task is cancelled at once, the office not told.</summary>
    private async Task WithdrawSurveyAsync(
        WorkflowTask inspectionTask,
        WorkflowTask survey,
        Guid propertyId,
        InspectedTypeChange change,
        PartySubmissionActor? actor,
        DateTime now,
        CancellationToken cancellationToken)
    {
        await _tasks.PatchAsync(
            survey.Id,
            new PatchWorkflowTaskRequest { Status = WorkflowTaskStatusValues.Cancelled },
            cancellationToken);
        await ClearOfficeFromDistributionAsync(inspectionTask, cancellationToken);
        await _timeline.RecordAsync(
            inspectionTask.PoNumber,
            propertyId,
            $"inspected-type:{inspectionTask.Id}:survey-withdrawn:{now.Ticks}",
            "سُحب الرفع المساحي",
            $"النوع الجديد «{change.NewType}» لا يحتاج رفعاً مساحياً — {survey.AssigneeName}",
            PropertyTimelineTones.Muted,
            now,
            cancellationToken);
        await _auditLog.AppendAsync(_audit.Create(
            actorId: string.IsNullOrWhiteSpace(actor?.UserId) ? "unknown" : actor.UserId,
            action: "case-study.engineering-survey.withdrawn",
            entityType: "WorkflowTask",
            entityId: survey.Id.ToString("D"),
            before: new { status = survey.Status.ToString() },
            after: new { status = "Cancelled", reason = "inspected-type-changed", propertyType = change.NewType }),
            cancellationToken);
    }
}
