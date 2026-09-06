using System.Text.Json;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.Domain;

namespace RealEstateEval.CaseStudy.Application.Services;

/// <summary>
/// Entity → DTO projection for case-study / party forms, shared by the single-item service and
/// the batch read so both return byte-identical shapes for the same row.
/// </summary>
internal static class CaseStudyFormMapping
{
    private static readonly JsonSerializerOptions JsonOpts = JsonDefaults.CamelCase;

    /// <summary>The unsaved form a task starts with — first open is 200, not 404.</summary>
    public static CaseStudyFormDto EmptyDto(WorkflowTask task) =>
        new()
        {
            TaskId = task.Id.ToString(),
            PropertyId = task.PropertyId?.ToString(),
            PoNumber = task.PoNumber,
            Status = "new",
        };

    public static CaseStudyFormDto ToDto(CaseStudyForm entity)
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
            DeedNatureMatchOutcome = entity.DeedNatureMatchOutcome,
            DeedNatureMatchNotes = entity.DeedNatureMatchNotes,
            SavedAtUtc = entity.SavedAtUtc?.ToString("O"),
        };
    }

    public static Dictionary<string, object?> ParseAnswers(string? json)
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
}
