using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using System.Text.Json;

namespace RealEstateEval.Infrastructure.Services;

public class CaseStudyFormService : ICaseStudyFormService
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    private const string CaseStudyPropertyKind = "case-study-property";
    private const string FormStatusSubmitted = "submitted";

    private readonly ApplicationDbContext _db;
    private readonly ICaseStudyValuationDispatchService _valuationDispatch;
    private readonly IWorkflowTaskService _workflowTasks;

    public CaseStudyFormService(
        ApplicationDbContext db,
        ICaseStudyValuationDispatchService valuationDispatch,
        IWorkflowTaskService workflowTasks)
    {
        _db = db;
        _valuationDispatch = valuationDispatch;
        _workflowTasks = workflowTasks;
    }

    public async Task<CaseStudyFormDto?> GetAsync(
        Guid taskId,
        bool party,
        CancellationToken cancellationToken = default)
    {
        var entity = await _db.CaseStudyForms
            .AsNoTracking()
            .FirstOrDefaultAsync(
                f => f.TaskId == taskId && f.IsPartyForm == party,
                cancellationToken);
        return entity is null ? null : ToDto(entity);
    }

    public async Task<(CaseStudyFormDto? Result, Dictionary<string, string>? Errors)> SaveAsync(
        Guid taskId,
        bool party,
        CaseStudyFormDto form,
        CaseStudyFormActor? actor = null,
        CancellationToken cancellationToken = default)
    {
        var entity = await _db.CaseStudyForms.FirstOrDefaultAsync(
            f => f.TaskId == taskId && f.IsPartyForm == party,
            cancellationToken);

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
        var now = DateTime.UtcNow;
        if (entity is null)
        {
            entity = new CaseStudyForm
            {
                Id = Guid.NewGuid(),
                TaskId = taskId,
                IsPartyForm = party,
                CreatedAtUtc = now,
            };
            _db.CaseStudyForms.Add(entity);
        }

        ApplyDto(entity, form, now);

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

            var task = await _db.WorkflowTasks.AsNoTracking()
                .FirstOrDefaultAsync(t => t.Id == taskId, cancellationToken);
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
            await _valuationDispatch.TryCreateFromCaseStudySubmissionAsync(taskId, cancellationToken);
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

        var task = await _db.WorkflowTasks
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == partyTaskId, cancellationToken);

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

        var parentSubmitted = await _db.CaseStudyForms
            .AsNoTracking()
            .AnyAsync(
                f => f.TaskId == parentId
                     && !f.IsPartyForm
                     && f.Status == FormStatusSubmitted,
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
        var childTaskIds = await _db.WorkflowTasks
            .AsNoTracking()
            .Where(t => t.ParentTaskId == parentTaskId)
            .Select(t => t.Id)
            .ToListAsync(cancellationToken);
        if (childTaskIds.Count == 0)
            return;

        var partyForms = await _db.CaseStudyForms
            .Where(f => f.IsPartyForm && childTaskIds.Contains(f.TaskId))
            .ToListAsync(cancellationToken);

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
        var task = await _db.WorkflowTasks
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == taskId, cancellationToken);
        if (task is null
            || !string.Equals(task.Kind, CaseStudyPropertyKind, StringComparison.OrdinalIgnoreCase)
            || WorkflowTaskStatus.IsTerminal(task.Status))
        {
            return;
        }

        await _workflowTasks.PatchAsync(
            taskId,
            new PatchWorkflowTaskRequest
            {
                Status = WorkflowTaskStatus.Completed,
                Phase = "done",
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
        entity.SavedAtUtc = now;
        entity.UpdatedAtUtc = now;
    }

    private static CaseStudyFormDto ToDto(CaseStudyForm entity)
    {
        var answers = ParseAnswers(entity.AnswersJson);

        Dictionary<string, bool>? specialistReview = null;
        if (!string.IsNullOrWhiteSpace(entity.SpecialistReviewApprovedJson))
        {
            try
            {
                specialistReview = JsonSerializer.Deserialize<Dictionary<string, bool>>(
                    entity.SpecialistReviewApprovedJson, JsonOpts);
            }
            catch
            {
                specialistReview = new();
            }
        }

        var provenance = CaseStudyAnswerProvenance.Parse(entity.AnswerProvenanceJson);

        return new CaseStudyFormDto
        {
            TaskId = entity.TaskId.ToString(),
            PropertyId = entity.PropertyId?.ToString(),
            PoNumber = entity.PoNumber,
            Status = entity.Status,
            CurrentStep = entity.CurrentStep,
            RequestNumber = entity.RequestNumber,
            RequestDate = entity.RequestDate,
            DeedNumber = entity.DeedNumber,
            Answers = answers,
            AnswerProvenance = provenance.Count == 0 ? null : provenance,
            DeedRemarks = entity.DeedRemarks,
            SurveyRemarks = entity.SurveyRemarks,
            ComponentsRemarks = entity.ComponentsRemarks,
            OccupancyRemarks = entity.OccupancyRemarks,
            MeterType = entity.MeterType,
            MeterNumber = entity.MeterNumber,
            HoaFee = entity.HoaFee,
            SigDeed = entity.SigDeed,
            SigApprover = entity.SigApprover,
            SigDate = entity.SigDate,
            SpecialistReviewApproved = specialistReview,
            InfathLinkedAssets = entity.InfathLinkedAssets,
            InfathLinkedDeedNumbers = entity.InfathLinkedDeedNumbers,
            InfathLinkedAssetsNotes = entity.InfathLinkedAssetsNotes,
            InfathOtherNotes = entity.InfathOtherNotes,
            InfathClosingNotes = entity.InfathClosingNotes,
            SavedAtUtc = entity.SavedAtUtc?.ToString("O"),
        };
    }

    private static Dictionary<string, object?> ParseAnswers(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new();
        try
        {
            return JsonSerializer.Deserialize<Dictionary<string, object?>>(json, JsonOpts) ?? new();
        }
        catch
        {
            return new();
        }
    }

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
