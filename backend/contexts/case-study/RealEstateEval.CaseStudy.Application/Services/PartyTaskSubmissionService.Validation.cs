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

        // The appraiser's submission is opened by the specialist issuing the case-study report.
        // Hard block — deliberately outside the documentary gates, so no role bypasses it.
        if (entity.Kind == WorkflowTaskKindValues.PropertyAppraisal)
        {
            var studyError = PartyTaskSubmissionRules.StudyReportGateError(
                await StudyReportIssuedForAsync(entity.WorkflowTaskId, cancellationToken));
            if (studyError is not null)
            {
                foreach (var (key, message) in studyError)
                    errors[key] = message;
            }
        }

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

    /// <summary>
    /// Whether the case-study report of the party task's parent is issued. A party task with no
    /// parent cannot have one, so it reads as not issued — the gate fails closed.
    /// </summary>
    private async Task<bool> StudyReportIssuedForAsync(
        Guid partyTaskId,
        CancellationToken cancellationToken)
    {
        var facts = await _repo.ListTaskFactsAsync([partyTaskId], cancellationToken);
        return facts.Count > 0
            && facts[0].ParentTaskId is Guid parentTaskId
            && await _repo.IsCaseStudyReportIssuedAsync(parentTaskId, cancellationToken);
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
        // The survey gate freezes only while the specialist has not lifted the failure's freeze;
        // every other kind keeps the plain "a failure is active" meaning.
        var hasActiveFailure = entity.Kind == WorkflowTaskKindValues.EngineeringSurvey
            ? await _failures.HasSurveyFreezingFailureAsync(
                entity.PoNumber ?? "",
                propertyIdStr,
                cancellationToken)
            : await _failures.HasActiveFailureAsync(
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
