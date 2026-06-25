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

    private readonly ApplicationDbContext _db;
    private readonly ICaseStudyValuationDispatchService _valuationDispatch;

    public CaseStudyFormService(
        ApplicationDbContext db,
        ICaseStudyValuationDispatchService valuationDispatch)
    {
        _db = db;
        _valuationDispatch = valuationDispatch;
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

    public async Task<CaseStudyFormDto> SaveAsync(
        Guid taskId,
        bool party,
        CaseStudyFormDto form,
        CancellationToken cancellationToken = default)
    {
        var entity = await _db.CaseStudyForms.FirstOrDefaultAsync(
            f => f.TaskId == taskId && f.IsPartyForm == party,
            cancellationToken);

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
            && string.Equals(form.Status, "submitted", StringComparison.OrdinalIgnoreCase)
            && !string.Equals(previousStatus, "submitted", StringComparison.OrdinalIgnoreCase))
        {
            await _valuationDispatch.TryCreateFromCaseStudySubmissionAsync(taskId, cancellationToken);
        }

        return ToDto(entity);
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
            SavedAtUtc = entity.SavedAtUtc?.ToString("O"),
        };
    }
}
