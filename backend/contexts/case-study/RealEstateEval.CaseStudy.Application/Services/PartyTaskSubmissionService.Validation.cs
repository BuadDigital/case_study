using System.Text.Json;
using RealEstateEval.Application;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.CaseStudy.Application.Rules;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Application.Services;

/// <summary>
/// Submit-time validation: payload rules, documentary gates (facts gathered here, decided in
/// <see cref="PartyTaskSubmissionRules"/>), attachment verification, and the field-inspection
/// workspace projection that follows every payload write.
/// </summary>
public partial class PartyTaskSubmissionService
{
    private async Task<Dictionary<string, string>> ValidateForSubmitAsync(
        PartyTaskSubmission entity,
        CancellationToken cancellationToken)
    {
        var errors = PartyTaskSubmissionPayloadRules.ValidateForSubmit(entity);
        var documentary = await ValidateDocumentaryGatesAsync(entity, cancellationToken);
        foreach (var (key, message) in documentary)
            errors[key] = message;

        if (errors.Count > 0)
            return errors;

        try
        {
            using var doc = JsonDocument.Parse(entity.PayloadJson);
            if (entity.Kind == WorkflowTaskKindValues.FieldInspection)
            {
                var attachmentErrors = await _fieldInspectionAttachments.VerifyAsync(
                    entity.WorkflowTaskId,
                    doc.RootElement,
                    cancellationToken);
                foreach (var (key, message) in attachmentErrors)
                    errors[key] = message;
            }
        }
        catch
        {
            errors["_"] = "بيانات الإرسال غير صالحة";
        }

        return errors;
    }

    private async Task<Dictionary<string, string>> ValidateDocumentaryGatesAsync(
        PartyTaskSubmission entity,
        CancellationToken cancellationToken)
    {
        var bypass = DocumentaryWorkflowRules.RoleBypassesDocumentaryGates(
            await _currentRole.ResolveAsync(cancellationToken));

        WorkOrderProperty? property = null;
        if (entity.PropertyId is Guid propertyId)
            property = await _repo.GetPropertyWithContactsAsync(propertyId, cancellationToken);

        var propertyIdStr = entity.PropertyId?.ToString() ?? "";
        var hasActiveFailure = await _failures.HasActiveFailureAsync(
            entity.PoNumber ?? "",
            propertyIdStr,
            cancellationToken);

        using var doc = JsonDocument.Parse(entity.PayloadJson);

        // Only the survey gate asks about the sibling inspection — one query, survey packages only.
        var inspectionCompleted = entity.Kind == WorkflowTaskKindValues.EngineeringSurvey
            && entity.PropertyId is Guid pid
            && (await SiblingInspectionFlagsAsync(
                entity.WorkflowTaskId, pid, includeAccepted: false, cancellationToken)).Completed;

        return PartyTaskSubmissionRules.DocumentaryGateErrors(
            entity.Kind,
            doc.RootElement,
            bypass,
            inspectionCompleted,
            hasActiveFailure,
            property);
    }

    private async Task SyncFieldInspectionWorkspaceAsync(
        PartyTaskSubmission entity,
        CancellationToken cancellationToken)
    {
        using var doc = JsonDocument.Parse(entity.PayloadJson);
        var projected = FieldInspectionWorkspaceProjector.Project(
            entity, doc.RootElement, _time.UtcNow());
        await _repo.UpsertFieldInspectionWorkspaceAsync(projected, cancellationToken);
    }
}
