namespace RealEstateEval.Domain;

/// <summary>ظرف مفاتيح — وحدة التتبع الأساسية.</summary>
public class KeyEnvelope
{
    public Guid Id { get; set; }
    /// <summary>رقم الطلب من إنفاذ — مرجع الظرف.</summary>
    public string RequestNumber { get; set; } = "";
    public string Court { get; set; } = "";
    public string Circuit { get; set; } = "";
    /// <summary>العدد المكتوب على الظرف.</summary>
    public int KeysCountLabeled { get; set; }
    /// <summary>العدد الفعلي بعد العد — المعتمد في النظام.</summary>
    public int KeysCountActual { get; set; }
    public Guid? ReceiptAttachmentId { get; set; }
    public Guid? PhotoAttachmentId { get; set; }
    /// <summary>خطاب من حامل المفتاح — سيناريو ج.</summary>
    public Guid? ThirdPartyLetterAttachmentId { get; set; }
    public string? ContactPhones { get; set; }
    public string? Notes { get; set; }
    /// <summary>court | missing | third_party</summary>
    public string ReceiveScenario { get; set; } = KeyReceiveScenarios.Court;
    /// <summary>reviewer | assessor | external | returned</summary>
    public string Status { get; set; } = KeyEnvelopeStatuses.Reviewer;
    public bool FeeGenerated { get; set; }
    public decimal? FeeAmountSar { get; set; }
    public string CreatedByUserId { get; set; } = "";
    public string CreatedByName { get; set; } = "";
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
    /// <summary>Optional link to the court_visit operations task that received this envelope.</summary>
    public Guid? OperationsTaskId { get; set; }

    public List<KeyEnvelopeAssignment> Assignments { get; set; } = [];
    public List<KeyEnvelopeHandoff> Handoffs { get; set; } = [];
    public List<KeyEnvelopeTimelineEntry> Timeline { get; set; } = [];
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
    /// <summary>أ — المفاتيح بالمحكمة.</summary>
    public const string Court = "court";
    /// <summary>ب — المفاتيح غير موجودة.</summary>
    public const string Missing = "missing";
    /// <summary>ج — المفاتيح عند طرف آخر.</summary>
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

/// <summary>مناولة عهدة الظرف.</summary>
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
    public const string FeeGenerated = "fee_generated";
    public const string StatusChanged = "status_changed";
}

/// <summary>مسار دخول مستقل عن الظرف: تمكين / محظر إخلاء.</summary>
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
