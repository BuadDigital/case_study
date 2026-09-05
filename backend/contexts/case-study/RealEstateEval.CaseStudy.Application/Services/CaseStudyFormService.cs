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

public class CaseStudyFormService : ICaseStudyFormService
{
    private static readonly JsonSerializerOptions JsonOpts = JsonDefaults.CamelCase;

    private const WorkflowTaskKind CaseStudyPropertyKind = WorkflowTaskKind.CaseStudyProperty;
    private const string FormStatusSubmitted = CaseStudyFormStatuses.Submitted;

    private readonly ICaseStudyFormRepository _db;
    private readonly IWorkflowTaskService _workflowTasks;
    private readonly IPropertyComparableLinkLookup? _comparableLinks;
    private readonly TimeProvider _time;

    public CaseStudyFormService(
        ICaseStudyFormRepository db,
        IWorkflowTaskService workflowTasks,
        IPropertyComparableLinkLookup? comparableLinks = null,
        TimeProvider? time = null)
    {
        _time = time ?? TimeProvider.System;

        _db = db;
        _workflowTasks = workflowTasks;
        _comparableLinks = comparableLinks;
    }

    public async Task<CaseStudyFormDto?> GetAsync(
        Guid taskId,
        bool party,
        CaseStudyFormActor? actor = null,
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
        CaseStudyFormActor actor,
        CancellationToken cancellationToken)
    {
        if (PoRoleMatrixRules.CanManagePartySubmissions(actor.PrototypeRole)) return true;

        var assigneeIds = await _db.ListTaskAndChildAssigneeIdsAsync(taskId, cancellationToken);

        return CaseStudyFormReadRules.CanRead(actor, assigneeIds);
    }

    public async Task<(CaseStudyFormDto? Result, Dictionary<string, string>? Errors)> SaveAsync(
        Guid taskId,
        bool party,
        CaseStudyFormDto form,
        CaseStudyFormActor? actor = null,
        CancellationToken cancellationToken = default)
    {
 // gate integrity — unknown outcomes rejected; discrepancy/failure need written notes.
        var matchOutcome = (form.DeedNatureMatchOutcome ?? "").Trim().ToLowerInvariant();
        if (!DeedNatureMatchOutcomes.IsKnown(matchOutcome))
        {
            return (null, new Dictionary<string, string>
            {
                ["deedNatureMatchOutcome"] = "مخرج المطابقة غير معروف",
            });
        }

        if (matchOutcome is DeedNatureMatchOutcomes.Differences or DeedNatureMatchOutcomes.Impediment
            && string.IsNullOrWhiteSpace(form.DeedNatureMatchNotes))
        {
            return (null, new Dictionary<string, string>
            {
                ["deedNatureMatchNotes"] = "ملاحظات المطابقة إلزامية عند «فروق» أو «مرشح تعذر»",
            });
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

    private async Task<(CaseStudyFormDto? Result, Dictionary<string, string>? Errors)> SaveOnceAsync(
        Guid taskId,
        bool party,
        CaseStudyFormDto form,
        CaseStudyFormActor? actor,
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
        else if (entity is not null && string.Equals(entity.Status, FormStatusSubmitted, StringComparison.OrdinalIgnoreCase))
        {
            return (null, new Dictionary<string, string>
            {
                ["_"] = "تم رفع نموذج دراسة الحالة — لا يمكن تعديله",
            });
        }
        else if (!party && actor is not null
                 && !PoRoleMatrixRules.CanEditProperty(actor.PrototypeRole)
                 && !PoRoleMatrixRules.CanManagePartySubmissions(actor.PrototypeRole))
        {
            return (null, new Dictionary<string, string>
            {
                ["_"] = "ليس لديك صلاحية تعديل نموذج دراسة الحالة",
            });
        }

        var previousStatus = entity?.Status;
        var previousAnswers = ParseAnswers(entity?.AnswersJson);
        var previousRemarks = ReadRemarkMap(entity);
        var previousProvenance = CaseStudyAnswerProvenance.Parse(entity?.AnswerProvenanceJson);
        var now = _time.UtcNow();
        if (entity is null)
        {
            entity = new CaseStudyForm
            {
                Id = Guid.NewGuid(),
                TaskId = taskId,
                IsPartyForm = party,
                CreatedAtUtc = now,
            };
            _db.AddForm(entity);
        }

        ApplyDto(entity, form, now);

        if (!party
            && string.Equals(form.Status, FormStatusSubmitted, StringComparison.OrdinalIgnoreCase)
            && !string.Equals(previousStatus, FormStatusSubmitted, StringComparison.OrdinalIgnoreCase)
            && _comparableLinks is not null)
        {
            var propertyId = Guid.TryParse(form.PropertyId, out var parsed) ? parsed : entity.PropertyId;
            if (propertyId is Guid pid && pid != Guid.Empty)
            {
                int linked;
                try
                {
                    linked = await _comparableLinks.CountLinkedAsync(pid, cancellationToken);
                }
                catch
                {
                    return (null, new Dictionary<string, string>
                    {
                        ["_"] = "تعذّر التحقق من المقارنات المربوطة — أعد المحاولة قبل رفع النموذج للمقيم.",
                    });
                }
                if (!PropertyComparableLinkRules.MeetsMinimum(linked))
                {
                    return (null, new Dictionary<string, string>
                    {
                        ["_"] =
                            $"لا يمكن رفع دراسة الحالة وإرسالها للمقيم قبل ربط {PropertyComparableLinkRules.MinimumLinkedForAppraisalPrep} مقارنين على الأقل بهذا العقار.",
                    });
                }
            }
        }

        if (actor is not null)
        {
            var nextAnswers = form.Answers ?? new Dictionary<string, object?>();
            var previousValues = new Dictionary<string, string?>(StringComparer.Ordinal);
            foreach (var (key, value) in previousAnswers)
                previousValues[key] = CaseStudyAnswerProvenance.NormalizeAnswerValue(value);
            foreach (var (key, value) in previousRemarks)
                previousValues[key] = value;

            var nextValues = new Dictionary<string, string?>(StringComparer.Ordinal);
            foreach (var (key, value) in nextAnswers)
                nextValues[key] = CaseStudyAnswerProvenance.NormalizeAnswerValue(value);
            foreach (var (key, value) in ReadRemarkMapFromDto(form))
                nextValues[key] = value;

            var task = await _db.GetTaskAsync(taskId, cancellationToken);
            var sourcePartyId = PartyIdForAssigneeRole(task?.AssigneeRole);

            var merged = CaseStudyAnswerProvenance.MergeChanged(
                previousProvenance,
                previousValues,
                nextValues,
                actor,
                taskId,
                entity.Id,
                sourcePartyId,
                now);
            entity.AnswerProvenanceJson = CaseStudyAnswerProvenance.Serialize(merged);
        }

        await _db.SaveChangesAsync(cancellationToken);

        if (!party
            && string.Equals(form.Status, FormStatusSubmitted, StringComparison.OrdinalIgnoreCase)
            && !string.Equals(previousStatus, FormStatusSubmitted, StringComparison.OrdinalIgnoreCase))
        {
            await TryCompleteCaseStudyWorkflowTaskAsync(taskId, cancellationToken);
            await LockPartyFormsAsync(taskId, now, cancellationToken);
        }

        return (ToDto(entity), null);
    }

    private async Task<Dictionary<string, string>?> ValidatePartySaveAllowedAsync(
        Guid partyTaskId,
        CaseStudyForm? existingEntity,
        CaseStudyFormActor? actor,
        CancellationToken cancellationToken)
    {
        if (existingEntity is not null
            && string.Equals(existingEntity.Status, FormStatusSubmitted, StringComparison.OrdinalIgnoreCase))
        {
            return new Dictionary<string, string>
            {
                ["_"] = "تم إغلاق نموذج الطرف بعد رفع دراسة الحالة",
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

        var parentSubmitted = await _db.CaseStudyFormHasStatusAsync(
            parentId,
            FormStatusSubmitted,
            cancellationToken);
        if (!parentSubmitted)
            return null;

        return new Dictionary<string, string>
        {
            ["_"] = "تم رفع نموذج دراسة الحالة — لا يمكن تعديل إجابات الأطراف",
        };
    }

    private async Task LockPartyFormsAsync(
        Guid parentTaskId,
        DateTime now,
        CancellationToken cancellationToken)
    {
        var childTaskIds = await _db.ListChildTaskIdsAsync(parentTaskId, cancellationToken);
        if (childTaskIds.Count == 0)
            return;

        var partyForms = await _db.ListPartyFormsForUpdateAsync(childTaskIds, cancellationToken);

        var changed = false;
        foreach (var partyForm in partyForms)
        {
            if (string.Equals(partyForm.Status, FormStatusSubmitted, StringComparison.OrdinalIgnoreCase))
                continue;

            partyForm.Status = FormStatusSubmitted;
            partyForm.UpdatedAtUtc = now;
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

    private static void ApplyDto(CaseStudyForm entity, CaseStudyFormDto dto, DateTime now)
    {
        entity.PropertyId = Guid.TryParse(dto.PropertyId, out var pid) ? pid : null;
        entity.PoNumber = dto.PoNumber;
        entity.Status = dto.Status;
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

    // Projection lives in CaseStudyFormMapping so the batch read returns the same shape.
    private static CaseStudyFormDto EmptyDto(WorkflowTask task) => CaseStudyFormMapping.EmptyDto(task);

    private static CaseStudyFormDto ToDto(CaseStudyForm entity) => CaseStudyFormMapping.ToDto(entity);

    private static Dictionary<string, object?> ParseAnswers(string? json) =>
        CaseStudyFormMapping.ParseAnswers(json);

    private static Dictionary<string, string?> ReadRemarkMap(CaseStudyForm? entity)
    {
        if (entity is null) return new(StringComparer.Ordinal);
        return new Dictionary<string, string?>(StringComparer.Ordinal)
        {
            [CaseStudyAnswerProvenance.DeedRemarksKey] = entity.DeedRemarks,
            [CaseStudyAnswerProvenance.SurveyRemarksKey] = entity.SurveyRemarks,
            [CaseStudyAnswerProvenance.ComponentsRemarksKey] = entity.ComponentsRemarks,
            [CaseStudyAnswerProvenance.OccupancyRemarksKey] = entity.OccupancyRemarks,
        };
    }

    private static Dictionary<string, string?> ReadRemarkMapFromDto(CaseStudyFormDto dto) =>
        new(StringComparer.Ordinal)
        {
            [CaseStudyAnswerProvenance.DeedRemarksKey] = dto.DeedRemarks,
            [CaseStudyAnswerProvenance.SurveyRemarksKey] = dto.SurveyRemarks,
            [CaseStudyAnswerProvenance.ComponentsRemarksKey] = dto.ComponentsRemarks,
            [CaseStudyAnswerProvenance.OccupancyRemarksKey] = dto.OccupancyRemarks,
        };

    private static string? PartyIdForAssigneeRole(string? assigneeRole) =>
        (assigneeRole?.Trim().ToLowerInvariant()) switch
        {
            "field-inspector" => "insp",
            "engineering-office" => "eng",
            "real-estate-appraiser" => "val",
            "government-reviewer" => "gov",
            _ => null,
        };
}
