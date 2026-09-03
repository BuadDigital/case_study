namespace RealEstateEval.Operations.Domain;

/// <summary>Key envelope — primary tracking unit.</summary>
public class KeyEnvelope
{
    public Guid Id { get; set; }
 /// <summary>Enfaz request number — envelope reference.</summary>
    public string RequestNumber { get; set; } = "";
 /// <summary>Numbering workshop: Internal reference number KE-{year}-{sequence 5}.</summary>
    public string? ReferenceNumber { get; set; }
    public string Court { get; set; } = "";
    public string Circuit { get; set; } = "";
 /// <summary>The number written on the envelope.</summary>
    public int KeysCountLabeled { get; set; }
 /// <summary>The actual number after counting — approved in the system.</summary>
    public int KeysCountActual { get; set; }
    public Guid? ReceiptAttachmentId { get; set; }
    public Guid? PhotoAttachmentId { get; set; }
 /// <summary>Letter from the Keyholder — Scenario C.</summary>
    public Guid? ThirdPartyLetterAttachmentId { get; set; }
    public string? ContactPhones { get; set; }
    public string? Notes { get; set; }
 /// <summary>court | missing | third_party</summary>
    public string ReceiveScenario { get; set; } = KeyReceiveScenarios.Court;
 /// <summary>reviewer | assessor | external | returned</summary>
    public string Status { get; set; } = KeyEnvelopeStatuses.Reviewer;
 /// <summary>
 /// Historical only. Key-receipt revenue used to be stamped here from the pricing table; it is now
 /// billed to Enfaz by finance, so nothing writes these any more. Kept because financial records are
 /// never deleted.
 /// </summary>
    public bool FeeGenerated { get; set; }
    public decimal? FeeAmountSar { get; set; }

 /// <summary>
 /// Entitlement indicator — set when a court envelope is registered, which is what earns the receipt revenue
 /// from Enfaz. It carries no amount: finance enters that during enforcement billing.
 /// </summary>
    public DateTime? RevenueEntitlementAtUtc { get; set; }

    public string CreatedByUserId { get; set; } = "";
    public string CreatedByName { get; set; } = "";
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
 /// <summary>Optional link to the court_visit operations task that received this envelope.</summary>
    public Guid? OperationsTaskId { get; set; }

    public List<KeyEnvelopeAssignment> Assignments { get; set; } = [];
    public List<KeyEnvelopeHandoff> Handoffs { get; set; } = [];
    public List<KeyEnvelopeTimelineEntry> Timeline { get; set; } = [];

    public static KeyEnvelope Create(
        Guid id,
        string requestNumber,
        string court,
        string circuit,
        int keysCountLabeled,
        int keysCountActual,
        string receiveScenario,
        string createdByUserId,
        string createdByName,
        DateTime nowUtc,
        Guid? receiptAttachmentId = null,
        Guid? photoAttachmentId = null,
        Guid? thirdPartyLetterAttachmentId = null,
        string? contactPhones = null,
        string? notes = null,
        Guid? operationsTaskId = null) =>
        new()
        {
            Id = id,
            RequestNumber = requestNumber,
            Court = court,
            Circuit = circuit,
            KeysCountLabeled = Math.Max(0, keysCountLabeled),
            KeysCountActual = Math.Max(0, keysCountActual),
            ReceiptAttachmentId = receiptAttachmentId,
            PhotoAttachmentId = photoAttachmentId,
            ThirdPartyLetterAttachmentId = thirdPartyLetterAttachmentId,
            ContactPhones = contactPhones,
            Notes = notes,
            ReceiveScenario = receiveScenario,
            Status = KeyEnvelopeStatuses.Reviewer,
            CreatedByUserId = createdByUserId,
            CreatedByName = createdByName,
            CreatedAtUtc = nowUtc,
            UpdatedAtUtc = nowUtc,
            OperationsTaskId = operationsTaskId,
        };

    public void Touch(DateTime nowUtc) => UpdatedAtUtc = nowUtc;

    public void MarkCourtRevenueEntitlement(DateTime nowUtc)
    {
        RevenueEntitlementAtUtc = nowUtc;
        UpdatedAtUtc = nowUtc;
    }

 /// <summary>Map a handoff kind onto the envelope custody status (status machine edge).</summary>
    public void ApplyHandoffKind(string kind)
    {
        Status = kind switch
        {
            KeyHandoffKinds.Internal => KeyEnvelopeStatuses.Assessor,
            KeyHandoffKinds.External => KeyEnvelopeStatuses.External,
            KeyHandoffKinds.ReceiveBack => KeyEnvelopeStatuses.Reviewer,
            KeyHandoffKinds.ReturnCourt => KeyEnvelopeStatuses.Returned,
            _ => Status,
        };
    }

    public KeyEnvelopeAssignment AddPendingAssignment(
        Guid assignmentId,
        string deedNumber,
        Guid? propertyId,
        string? notes,
        DateTime nowUtc)
    {
        var row = new KeyEnvelopeAssignment
        {
            Id = assignmentId,
            EnvelopeId = Id,
            DeedNumber = deedNumber,
            PropertyId = propertyId,
            Status = KeyAssignmentStatuses.Pending,
            Notes = notes,
        };
        Assignments.Add(row);
        UpdatedAtUtc = nowUtc;
        return row;
    }

    public void ConfirmAssignmentField(
        KeyEnvelopeAssignment assignment,
        string status,
        string? notes,
        string actorUserId,
        string actorDisplayName,
        DateTime nowUtc)
    {
        assignment.Status = status;
        assignment.Notes = notes ?? assignment.Notes;
        assignment.ConfirmedByUserId = actorUserId;
        assignment.ConfirmedByName = actorDisplayName;
        assignment.ConfirmedAtUtc = nowUtc;
        UpdatedAtUtc = nowUtc;
    }
}

public static class KeyEnvelopeStatuses
{
    public const string Reviewer = "reviewer";
    public const string Assessor = "assessor";
    public const string External = "external";
    public const string Returned = "returned";
}

public static class KeyReceiveScenarios
{
 /// <summary>A - The keys to the court.</summary>
    public const string Court = "court";
 /// <summary>B — The keys are not present.</summary>
    public const string Missing = "missing";
 /// <summary>C - The keys are at another party.</summary>
    public const string ThirdParty = "third_party";
}

public class KeyEnvelopeAssignment
{
    public Guid Id { get; set; }
    public Guid EnvelopeId { get; set; }
    public string DeedNumber { get; set; } = "";
    public Guid? PropertyId { get; set; }
 /// <summary>pending | matched | partial | unmatched | unmatched_inspected | missing</summary>
    public string Status { get; set; } = KeyAssignmentStatuses.Pending;
    public string? Notes { get; set; }
    public string? ConfirmedByUserId { get; set; }
    public string? ConfirmedByName { get; set; }
    public DateTime? ConfirmedAtUtc { get; set; }

    public KeyEnvelope? Envelope { get; set; }
}

public static class KeyAssignmentStatuses
{
    public const string Pending = "pending";
    public const string Matched = "matched";
    public const string Partial = "partial";
    public const string Unmatched = "unmatched";
    public const string UnmatchedInspected = "unmatched_inspected";
    public const string Missing = "missing";

    public static bool IsConfirmResult(string status) =>
        status is Matched or Partial or Unmatched or UnmatchedInspected or Missing;

 /// <summary>Statuses that mean the key did not fully open the property.</summary>
    public static bool IsUnmatchedOutcome(string status) =>
        status is Unmatched or UnmatchedInspected or Missing;
}

/// <summary>Handling of envelope custody.</summary>
public class KeyEnvelopeHandoff
{
    public Guid Id { get; set; }
    public Guid EnvelopeId { get; set; }
 /// <summary>internal | external | receive_back | return_court</summary>
    public string Kind { get; set; } = KeyHandoffKinds.Internal;
    public string FromParty { get; set; } = "";
    public string ToParty { get; set; } = "";
    public string? ToUserId { get; set; }
    public string? LetterNumber { get; set; }
    public Guid? LetterAttachmentId { get; set; }
    public string? Notes { get; set; }
 /// <summary>pending_confirm | confirmed | completed</summary>
    public string Status { get; set; } = KeyHandoffStatuses.Completed;
    public string? ConfirmedByUserId { get; set; }
    public string? ConfirmedByName { get; set; }
    public DateTime? ConfirmedAtUtc { get; set; }
    public string CreatedByUserId { get; set; } = "";
    public string CreatedByName { get; set; } = "";
    public DateTime CreatedAtUtc { get; set; }

    public KeyEnvelope? Envelope { get; set; }
}

public static class KeyHandoffKinds
{
    public const string Internal = "internal";
    public const string External = "external";
    public const string ReceiveBack = "receive_back";
    public const string ReturnCourt = "return_court";
}

public static class KeyHandoffStatuses
{
    public const string PendingConfirm = "pending_confirm";
    public const string Confirmed = "confirmed";
    public const string Completed = "completed";
}

public class KeyEnvelopeTimelineEntry
{
    public Guid Id { get; set; }
    public Guid EnvelopeId { get; set; }
    public string EventType { get; set; } = "";
    public string Summary { get; set; } = "";
    public string ActorUserId { get; set; } = "";
    public string ActorName { get; set; } = "";
    public string? PayloadJson { get; set; }
    public DateTime CreatedAtUtc { get; set; }

    public KeyEnvelope? Envelope { get; set; }
}

public static class KeyEnvelopeTimelineEvents
{
    public const string Created = "created";
    public const string AssignmentAdded = "assignment_added";
    public const string AssignmentConfirmed = "assignment_confirmed";
    public const string HandoffCreated = "handoff_created";
    public const string HandoffConfirmed = "handoff_confirmed";
 /// <summary>Historical: a key-receipt amount was stamped from the pricing table.</summary>
    public const string FeeGenerated = "fee_generated";
 /// <summary>Key Receipt Revenue Accrual Indicator — No amount.</summary>
    public const string RevenueEntitlement = "revenue_entitlement";
    public const string StatusChanged = "status_changed";
}

/// <summary>Entry path independent of the envelope: access enablement / eviction record.</summary>
public class PropertyCourtAccess
{
    public Guid Id { get; set; }
    public Guid PropertyId { get; set; }
    public string PoNumber { get; set; } = "";
    public string DeedNumber { get; set; } = "";
    public string RequestNumber { get; set; } = "";
    public bool HasEnablingLetter { get; set; }
    public Guid? EnablingLetterAttachmentId { get; set; }
    public bool HasEvictionNotice { get; set; }
    public Guid? EvictionNoticeAttachmentId { get; set; }
 /// <summary>none | enabled_no_key | suspended_eviction</summary>
    public string StudyHoldStatus { get; set; } = PropertyCourtAccessStatuses.None;
    public string? ContactPhones { get; set; }
    public string? Notes { get; set; }
    public string UpdatedByUserId { get; set; } = "";
    public string UpdatedByName { get; set; } = "";
    public DateTime UpdatedAtUtc { get; set; }
}

public static class PropertyCourtAccessStatuses
{
    public const string None = "none";
    public const string EnabledNoKey = "enabled_no_key";
    public const string SuspendedEviction = "suspended_eviction";
}
