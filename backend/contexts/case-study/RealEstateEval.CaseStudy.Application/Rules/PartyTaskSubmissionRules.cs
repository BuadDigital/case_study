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

    /// <summary>
    /// Case staff may correct a party package from the property-edit screen: a submitted
    /// inspection / survey package (field values, map pin, etc.), and an inspection draft (the
    /// specialist's long-standing inspection-tab edits). Never the appraiser's package: his numbers
    /// are accepted or returned, not edited by staff.
    /// </summary>
    public static bool StaffMayCorrectPartyPackage(PartySubmissionActor? actor, WorkflowTask task) =>
        actor is not null
        && IsPartySubmissionKind(task.Kind)
        && task.Kind != WorkflowTaskKind.PropertyAppraisal
        && PoRoleMatrixRules.CanCorrectFieldInspectionSubmission(actor.PrototypeRole);

    /// <summary>
    /// Survey / appraisal drafts belong to their party — the party's next autosave would overwrite a
    /// staff edit — so staff correct those only once the package is submitted.
    /// </summary>
    public static bool StaffMayWriteWhileStatus(WorkflowTask task, string entityStatus) =>
        task.Kind == WorkflowTaskKind.FieldInspection
        || entityStatus is PartyTaskSubmissionStatus.Submitted;

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
    /// the inspection needs a party phone once the client declaration is signed and, on a traditional
    /// deed with available boundaries, an explicit «deed matches nature» verdict, and — when the
    /// inspected asset is land — an explicit yes/no «does the land hold buildings or annexes worth
    /// valuing» answer. Informal map-URL
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

                // The inspector's yes/no verdict on the deed boundaries against the site is a data
                // requirement, not a documentary gate — the role bypass does not skip it. Checked
                // only when the property is known (a package with no property has no deed to match).
                if (property is not null)
                {
                    foreach (var (key, message) in InspectorDeedNatureMatchRules.Validate(
                                 property.DeedKind,
                                 property.BoundariesAvailability,
                                 root))
                    {
                        errors[key] = message;
                    }

                    // An asset typed land must carry the inspector's explicit answer on whether the
                    // land holds buildings or annexes worth valuing — it decides whether the
                    // specialist's inventory table is mandatory. Data requirement: no role bypass.
                    if (InspectedPropertyTypeRules.IsLand(InspectedPropertyTypeRules.FromRoot(root))
                        && SpecialistComponentsRules.ReadLandHasValuableStructures(root) is null)
                    {
                        errors[SpecialistComponentsRules.LandHasValuableStructuresKey] =
                            SpecialistComponentsRules.LandHasValuableStructuresRequired;
                    }
                }
                break;
            }
        }

        return errors;
    }

    public const string StudyReportKey = "studyReport";

    public const string StudyReportNotIssuedAr =
        "لا يمكن تسليم التقييم قبل أن يصدر الأخصائي تقرير دراسة الحالة";

    /// <summary>
    /// The appraiser's submission waits on the specialist's issued case-study report. A hard block:
    /// unlike the documentary gates, no role bypasses it, so it is decided here from one fact — whether
    /// the parent's own (non-party) report is issued. Null when the report is issued.
    /// </summary>
    public static Dictionary<string, string>? StudyReportGateError(bool studyReportIssued) =>
        studyReportIssued
            ? null
            : new Dictionary<string, string> { [StudyReportKey] = StudyReportNotIssuedAr };

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
            FieldProvenance = PartyFieldProvenance.Parse(entity.FieldProvenanceJson),
        };
    }
}
