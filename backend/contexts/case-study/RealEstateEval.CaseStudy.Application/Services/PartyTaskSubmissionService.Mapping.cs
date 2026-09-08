using RealEstateEval.Domain;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Application.Services;

/// <summary>
/// DTO projection with the sibling field-inspection flags a single read needs; the pure
/// mapping itself lives in <see cref="PartyTaskSubmissionRules.ToDto"/>.
/// </summary>
public partial class PartyTaskSubmissionService
{
    private async Task<PartyTaskSubmissionDto> ToUnsavedDraftDtoAsync(
        WorkflowTask task,
        CancellationToken cancellationToken)
    {
        var dto = await ToDtoAsync(PartyTaskSubmissionRules.UnsavedDraft(task), cancellationToken);
        dto.Id = "";
        return dto;
    }

    private async Task<PartyTaskSubmissionDto> ToDtoAsync(
        PartyTaskSubmission entity,
        CancellationToken cancellationToken)
    {
        var dto = PartyTaskSubmissionRules.ToDto(entity);
        if (!NeedsInspectionFlag(entity.Kind))
            return dto;

        var flags = entity.PropertyId is Guid propertyId
            ? await SiblingInspectionFlagsAsync(
                entity.WorkflowTaskId,
                propertyId,
                includeAccepted: entity.Kind == WorkflowTaskKindValues.PropertyAppraisal,
                cancellationToken)
            : (Completed: false, Accepted: false);

        dto.FieldInspectionCompleted = flags.Completed;
        if (entity.Kind == WorkflowTaskKindValues.PropertyAppraisal)
            dto.FieldInspectionAccepted = flags.Accepted;

        return dto;
    }
}
