using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Application.Services;

/// <summary>Answer / remark provenance: who answered or edited what, stamped on save and on issue.</summary>
public partial class CaseStudyReportService
{
    /// <summary>
    /// Diffs the answers and remarks against the stored row and stamps who changed what — the same
    /// provenance a plain save writes, so an issue records the specialist's last edits too.
    /// </summary>
    private async Task StampProvenanceAsync(
        CaseStudyReport entity,
        CaseStudyReportDto form,
        Dictionary<string, object?> previousAnswers,
        Dictionary<string, string?> previousRemarks,
        Dictionary<string, AnswerProvenanceEntryDto> previousProvenance,
        CaseStudyReportActor actor,
        Guid taskId,
        DateTime now,
        CancellationToken cancellationToken)
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

    private static Dictionary<string, object?> ParseAnswers(string? json) =>
        CaseStudyReportMapping.ParseAnswers(json);

    private static Dictionary<string, string?> ReadRemarkMap(CaseStudyReport? entity)
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

    private static Dictionary<string, string?> ReadRemarkMapFromDto(CaseStudyReportDto dto) =>
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
