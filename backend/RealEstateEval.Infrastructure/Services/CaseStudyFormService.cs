using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
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
                cancellationToken);
            if (partyErrors is not null)
                return (null, partyErrors);
        }

        var previousStatus = entity?.Status;
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
        Dictionary<string, object?> answers;
        try
        {
            answers = JsonSerializer.Deserialize<Dictionary<string, object?>>(
                entity.AnswersJson, JsonOpts) ?? new();
        }
        catch
        {
            answers = new();
        }

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

        return new CaseStudyFormDto
        {
            Version = 1,
            TaskId = entity.TaskId.ToString(),
            PropertyId = entity.PropertyId?.ToString(),
            PoNumber = entity.PoNumber,
            Status = entity.Status,
            CurrentStep = entity.CurrentStep,
            RequestNumber = entity.RequestNumber,
            RequestDate = entity.RequestDate,
            DeedNumber = entity.DeedNumber,
            Answers = answers,
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
}
