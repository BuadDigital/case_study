using System.Text.Json;

namespace RealEstateEval.CaseStudy.Application.Contracts;

public class PartyTaskSubmissionDto
{
    public string Id { get; set; } = "";
    public string TaskId { get; set; } = "";
    public string Kind { get; set; } = "";
    public string Status { get; set; } = "draft";
    public string? PropertyId { get; set; }
    public string? PoNumber { get; set; }
    public JsonElement Payload { get; set; }
    public string? ReturnNote { get; set; }
    public string? SubmittedAtUtc { get; set; }
    public string? AcceptedAtUtc { get; set; }
    public string? SubmittedByUserId { get; set; }
    public string? SubmittedByName { get; set; }
    public string? AcceptedByUserId { get; set; }
    public string? AcceptedByName { get; set; }
    public string? ReopenedByUserId { get; set; }
    public string? ReopenedByName { get; set; }
    public string UpdatedAtUtc { get; set; } = "";

 /// <summary>
 /// Engineering-survey / property-appraisal: sibling field-inspection is completed
 /// (authoritative for EO unlock). Also on WorkflowTaskDto list items.
 /// </summary>
    public bool? FieldInspectionCompleted { get; set; }

 /// <summary>
 /// Property-appraisal: sibling field-inspection package is specialist-accepted
 /// (authoritative for appraiser start). Also on WorkflowTaskDto list items.
 /// </summary>
    public bool? FieldInspectionAccepted { get; set; }

 /// <summary>
 /// Field-inspection: fingerprint of the property's specialist-owned source data as the
 /// server holds it now. The inspector's device sends it back with each save so a change
 /// made while the inspector worked offline alerts the specialist (spec §4.4).
 /// </summary>
    public string? SourceFingerprint { get; set; }

 /// <summary>
 /// Who wrote / last edited each payload field. Keys are top-level payload keys, or
 /// <c>parent.child</c> for one level of nesting (e.g. <c>featureValues.assetSubject</c>).
 /// </summary>
    public Dictionary<string, PartyFieldProvenanceEntryDto> FieldProvenance { get; set; } = new();
}

/// <summary>
/// Attribution for one party-payload field: the first writer, and — when someone else
/// changed the value afterwards — the latest editor.
/// </summary>
public class PartyFieldProvenanceEntryDto
{
    public string? WrittenByUserId { get; set; }
    public string? WrittenByName { get; set; }
    public string? WrittenByRole { get; set; }
    public string WrittenAtUtc { get; set; } = "";

    public string? EditedByUserId { get; set; }
    public string? EditedByName { get; set; }
    public string? EditedByRole { get; set; }
    public string? EditedAtUtc { get; set; }
}

public class SavePartyTaskSubmissionRequest
{
    public JsonElement Payload { get; set; }
}

public class ReopenPartyTaskSubmissionRequest
{
    public string ReturnNote { get; set; } = "";
}
