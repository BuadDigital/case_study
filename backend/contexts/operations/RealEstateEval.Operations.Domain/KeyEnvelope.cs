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

    /// <summary>
    /// Custody: who physically holds the envelope right now. The envelope is
    /// the custody unit — keys are unlabeled and move with it — and the holder changes only when a
    /// receipt is confirmed (internal / receive-back) or a letter closes it (external / court).
    /// </summary>
    public string HolderKind { get; set; } = KeyHolderKinds.Reviewer;
    public string? HolderUserId { get; set; }
    public string? HolderLabel { get; set; }
    public DateTime? HolderSinceUtc { get; set; }

    /// <summary>A handoff that reached its receiver: custody status and holder move together.</summary>
    /// <remarks>
    /// How it works: 1) sets <see cref="Status"/> from the handoff kind (<see cref="ApplyHandoffKind"/>);
    /// 2) sets the holder from the handoff — internal → internal_user (ToUserId, ToParty); external →
    /// external (label only); return_court → court (label only); receive_back (default branch) →
    /// reviewer (ToUserId, ToParty); 3) stamps HolderSinceUtc and UpdatedAtUtc.
    /// Edge cases: called only once a handoff is confirmed (internal / receive-back by the receiver) or
    /// completes at once (external / court, the letter is the proof), so a pending handoff never moves
    /// the holder. Outside parties and the court carry no user id.
    /// </remarks>
    public void ApplyConfirmedHandoff(KeyEnvelopeHandoff handoff, DateTime nowUtc)
    {
        ApplyHandoffKind(handoff.Kind);
        switch (handoff.Kind)
        {
            case KeyHandoffKinds.Internal:
                HolderKind = KeyHolderKinds.InternalUser;
                HolderUserId = handoff.ToUserId;
                HolderLabel = handoff.ToParty;
                break;
            case KeyHandoffKinds.External:
                HolderKind = KeyHolderKinds.External;
                HolderUserId = null;
                HolderLabel = handoff.ToParty;
                break;
            case KeyHandoffKinds.ReturnCourt:
                HolderKind = KeyHolderKinds.Court;
                HolderUserId = null;
                HolderLabel = handoff.ToParty;
                break;
            default:
                HolderKind = KeyHolderKinds.Reviewer;
                HolderUserId = handoff.ToUserId;
                HolderLabel = handoff.ToParty;
                break;
        }
        HolderSinceUtc = nowUtc;
        UpdatedAtUtc = nowUtc;
    }

    /// <summary>Where the deed's matching key is after the field trial (per deed — keys carry no tag).</summary>
    /// <remarks>
    /// How it works: writes the location on the assignment; keeps the holder user id and label only
    /// when the location is with_user, otherwise clears both; stamps KeyLocationAtUtc and the
    /// envelope's UpdatedAtUtc. The caller has already validated and defaulted the location.
    /// Edge cases: moving a key from with_user back to in_envelope / returned_court / missing drops the
    /// old holder, so a stale «عند فلان» never survives a correction.
    /// </remarks>
    public void SetAssignmentKeyLocation(
        KeyEnvelopeAssignment assignment,
        string location,
        string? holderUserId,
        string? holderLabel,
        DateTime nowUtc)
    {
        assignment.KeyLocation = location;
        assignment.KeyHolderUserId = location == KeyLocations.WithUser ? holderUserId : null;
        assignment.KeyHolderLabel = location == KeyLocations.WithUser ? holderLabel : null;
        assignment.KeyLocationAtUtc = nowUtc;
        UpdatedAtUtc = nowUtc;
    }

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

    public static readonly IReadOnlyList<string> All = [Reviewer, Assessor, External, Returned];
}

/// <summary>Who holds the envelope.</summary>
public static class KeyHolderKinds
{
    /// <summary>With the government reviewer (the office).</summary>
    public const string Reviewer = "reviewer";
    /// <summary>With a system user — an inspector or appraiser — identified by <c>HolderUserId</c>.</summary>
    public const string InternalUser = "internal_user";
    /// <summary>With an outside party, delivered under a letter.</summary>
    public const string External = "external";
    /// <summary>Returned to the court.</summary>
    public const string Court = "court";

    public static readonly IReadOnlyList<string> All = [Reviewer, InternalUser, External, Court];

    public static bool IsValid(string? kind) => kind is Reviewer or InternalUser or External or Court;
}

/// <summary>Where a deed's matching key is after the field trial.</summary>
public static class KeyLocations
{
    public const string InEnvelope = "in_envelope";
    public const string WithUser = "with_user";
    public const string ReturnedCourt = "returned_court";
    public const string Missing = "missing";

    public static readonly IReadOnlyList<string> All = [InEnvelope, WithUser, ReturnedCourt, Missing];

    public static bool IsValid(string? location) =>
        location is InEnvelope or WithUser or ReturnedCourt or Missing;

    /// <summary>What a trial result implies when the inspector says nothing about the key's place.</summary>
    /// <remarks>
    /// How it works: a «missing» trial result → missing; every other result (matched, partial,
    /// unmatched, unmatched_inspected) → in_envelope.
    /// Edge cases: with_user is never a default — the inspector must say he kept the key.
    /// </remarks>
    public static string DefaultFor(string assignmentStatus) =>
        assignmentStatus == KeyAssignmentStatuses.Missing ? Missing : InEnvelope;
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

    /// <summary>Where the deed's matching key is now — set at the trial, adjustable by the reviewer.</summary>
    public string KeyLocation { get; set; } = KeyLocations.InEnvelope;
    public string? KeyHolderUserId { get; set; }
    public string? KeyHolderLabel { get; set; }
    public DateTime? KeyLocationAtUtc { get; set; }

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

    public static readonly IReadOnlyList<string> All =
    [
        Pending, Matched, Partial, Unmatched, UnmatchedInspected, Missing,
    ];

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

    public static readonly IReadOnlyList<string> All = [PendingConfirm, Confirmed, Completed];
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
    /// <summary>The reviewer corrected where a deed's key is.</summary>
    public const string KeyLocationChanged = "key_location_changed";
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

    public static readonly IReadOnlyList<string> All = [None, EnabledNoKey, SuspendedEviction];
}
