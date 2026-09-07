using System.Text.Json;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.CaseStudy.Application.Contracts;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Application.Rules;

/// <summary>
/// Pure decision rules behind the party-submission use case: which task kinds submit through it,
/// who may write a draft, the documentary gates a package must clear before submit, the labels the
/// timeline stores, and the DTO projection. No ports, no I/O — the service supplies every fact.
/// </summary>
public static class PartyTaskSubmissionRules
{
    /// <summary>Party kinds that submit work through the service — everything but the parent.</summary>
    private static readonly HashSet<WorkflowTaskKind> AllowedKinds =
    [
        WorkflowTaskKind.EngineeringSurvey,
        WorkflowTaskKind.PropertyAppraisal,
        WorkflowTaskKind.FieldInspection,
    ];

    public static bool IsPartySubmissionKind(WorkflowTaskKind kind) => AllowedKinds.Contains(kind);

    public static Dictionary<string, string> Error(string message) => new() { ["_"] = message };

    /// <summary>Case staff may correct a submitted field-inspection package (map pin, etc.).</summary>
    public static bool StaffMayCorrectFieldInspection(PartySubmissionActor? actor, WorkflowTask task) =>
        actor is not null
        && task.Kind == WorkflowTaskKind.FieldInspection
        && PoRoleMatrixRules.CanCorrectFieldInspectionSubmission(actor.PrototypeRole);

    /// <summary>
    /// The assignee (or an anonymous caller) may write a draft; case staff may only when they
    /// hold the field-inspection correction right.
    /// </summary>
    public static bool MayWriteDraft(PartySubmissionActor? actor, WorkflowTask task, bool staffMayCorrect)
    {
        var canAssigneeWrite = actor is null
            || PoRoleMatrixRules.CanWritePartyTask(
                actor.PrototypeRole,
                task.AssigneeId,
                actor.UserId,
                actor.DistributionAssigneeId);
        return actor is null || canAssigneeWrite || staffMayCorrect;
    }

    /// <summary>Acceptance is stamped with the actor's user id, or «system» when there is none.</summary>
    public static string AcceptActorUserId(PartySubmissionActor actor) =>
        string.IsNullOrWhiteSpace(actor.UserId) ? "system" : actor.UserId;

    public static string AcceptedTimelineTitle(WorkflowTaskKind kind) => kind switch
    {
        WorkflowTaskKind.FieldInspection => "استلام بيانات المعاينة",
        WorkflowTaskKind.PropertyAppraisal => "اعتماد تقرير التقييم",
        _ => "قبول مخرجات الرفع المساحي",
    };

    /// <summary>Who the «submitted» timeline row names: the submitter, else the task assignee.</summary>
    public static string? SubmittedActorLabel(PartyTaskSubmission entity, WorkflowTask task) =>
        entity.SubmittedByName
        ?? (string.IsNullOrWhiteSpace(task.AssigneeName) ? null : task.AssigneeName);

    /// <summary>
    /// Documentary gates per kind: the survey needs a completed inspection and no active failure,
    /// a site letter unless the property is platted, and a party phone once the site is confirmed;
    /// the inspection needs a party phone once the client declaration is signed. Informal map-URL
    /// access gate removed — tasks are not assigned without initial data. Key envelopes remain
    /// tracked (payload keyAvailable) but do not block submit.
    /// </summary>
    public static Dictionary<string, string> DocumentaryGateErrors(
        string kind,
        JsonElement root,
        bool bypass,
        bool inspectionCompleted,
        bool hasActiveFailure,
        WorkOrderProperty? property)
    {
        var errors = new Dictionary<string, string>();
        var hasPhone = property is not null
            && DocumentaryWorkflowRules.HasAnyPartyPhone(property.Contacts);
        var phoneWasPresent = PartyTaskSubmissionPayloadRules.GetBool(root, "declarationPhoneSatisfied");

        switch (kind)
        {
            case WorkflowTaskKindValues.EngineeringSurvey:
            {
                var surveyBlock = DocumentaryWorkflowRules.SurveyWorkBlockReason(
                    bypass,
                    inspectionCompleted,
                    hasActiveFailure);
                if (surveyBlock is not null)
                    errors["_documentary"] = surveyBlock;

                PartyTaskSubmissionPayloadRules.RequireSiteLetterUnlessPlatted(
                    errors,
                    root,
                    property?.PlanNumber,
                    property?.PlotNumber);

                var phoneBlock = DocumentaryWorkflowRules.DeclarationPhoneBlockReason(
                    bypass,
                    hasPhone,
                    phoneWasPresent);
                if (phoneBlock is not null
                    && (PartyTaskSubmissionPayloadRules.HasNonEmpty(root, "siteLetterFileName")
                        || PartyTaskSubmissionPayloadRules.GetBool(root, "siteConfirmed")))
                {
                    errors["siteLetterFileName"] = phoneBlock;
                }
                break;
            }

            case WorkflowTaskKindValues.FieldInspection:
            {
                var phoneBlock = DocumentaryWorkflowRules.DeclarationPhoneBlockReason(
                    bypass,
                    hasPhone,
                    phoneWasPresent);
                if (phoneBlock is not null && PartyTaskSubmissionPayloadRules.GetBool(root, "clientDeclarationSigned"))
                    errors["clientDeclarationSigned"] = phoneBlock;
                break;
            }
        }

        return errors;
    }

    /// <summary>An unsaved draft shape for a party task that has no submission row yet.</summary>
    public static PartyTaskSubmission UnsavedDraft(WorkflowTask task) => new()
    {
        Id = Guid.Empty,
        WorkflowTaskId = task.Id,
        Kind = task.Kind.ToDbValue(),
        Status = PartyTaskSubmissionStatus.Draft,
        PropertyId = task.PropertyId,
        PoNumber = task.PoNumber,
        PayloadJson = "{}",
    };

    /// <summary>Wire projection; an unparsable payload is served as an empty object.</summary>
    public static PartyTaskSubmissionDto ToDto(PartyTaskSubmission entity)
    {
        JsonElement payload;
        try
        {
            payload = JsonDocument.Parse(entity.PayloadJson).RootElement.Clone();
        }
        catch
        {
            payload = JsonDocument.Parse("{}").RootElement.Clone();
        }

        return new PartyTaskSubmissionDto
        {
            Id = entity.Id.ToString(),
            TaskId = entity.WorkflowTaskId.ToString(),
            Kind = entity.Kind,
            Status = entity.Status,
            PropertyId = entity.PropertyId?.ToString(),
            PoNumber = entity.PoNumber,
            Payload = payload,
            ReturnNote = entity.ReturnNote,
            SubmittedAtUtc = entity.SubmittedAtUtc?.ToString("O"),
            AcceptedAtUtc = entity.AcceptedAtUtc?.ToString("O"),
            SubmittedByUserId = entity.SubmittedByUserId,
            SubmittedByName = entity.SubmittedByName,
            AcceptedByUserId = entity.AcceptedByUserId,
            AcceptedByName = entity.AcceptedByName,
            ReopenedByUserId = entity.ReopenedByUserId,
            ReopenedByName = entity.ReopenedByName,
            UpdatedAtUtc = entity.UpdatedAtUtc.ToString("O"),
        };
    }
}
