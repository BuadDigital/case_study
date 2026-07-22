using System.ComponentModel.DataAnnotations;

namespace RealEstateEval.Application.Contracts;

public class KeyEnvelopeLinkedPropertyDto
{
    public Guid PropertyId { get; init; }
    public string PoNumber { get; init; } = "";
    public string DeedNumber { get; init; } = "";
    public string OwnerName { get; init; } = "";
    public string City { get; init; } = "";
    public string Court { get; init; } = "";
    public string Circuit { get; init; } = "";
    public string RequestNumber { get; init; } = "";
}

public class KeyEnvelopeAssignmentDto
{
    public Guid Id { get; init; }
    public string DeedNumber { get; init; } = "";
    public Guid? PropertyId { get; init; }
    public string Status { get; init; } = "pending";
    public string? Notes { get; init; }
    public string? ConfirmedByName { get; init; }
    public DateTime? ConfirmedAtUtc { get; init; }
}

public class KeyEnvelopeHandoffDto
{
    public Guid Id { get; init; }
    public string Kind { get; init; } = "";
    public string FromParty { get; init; } = "";
    public string ToParty { get; init; } = "";
    public string? ToUserId { get; init; }
    public string? LetterNumber { get; init; }
    public Guid? LetterAttachmentId { get; init; }
    public string? Notes { get; init; }
    public string Status { get; init; } = "";
    public string? ConfirmedByName { get; init; }
    public DateTime? ConfirmedAtUtc { get; init; }
    public string CreatedByName { get; init; } = "";
    public DateTime CreatedAtUtc { get; init; }
}

public class KeyEnvelopeTimelineEntryDto
{
    public Guid Id { get; init; }
    public string EventType { get; init; } = "";
    public string Summary { get; init; } = "";
    public string ActorName { get; init; } = "";
    public DateTime CreatedAtUtc { get; init; }
}

public class KeyEnvelopeDto
{
    public Guid Id { get; init; }
    public string RequestNumber { get; init; } = "";
    public string Court { get; init; } = "";
    public string Circuit { get; init; } = "";
    public int KeysCountLabeled { get; init; }
    public int KeysCountActual { get; init; }
    public bool CountMismatch { get; init; }
    public Guid? ReceiptAttachmentId { get; init; }
    public Guid? PhotoAttachmentId { get; init; }
    public Guid? ThirdPartyLetterAttachmentId { get; init; }
    public string? ContactPhones { get; init; }
    public string? Notes { get; init; }
    public string ReceiveScenario { get; init; } = "court";
    public string Status { get; init; } = "reviewer";
    public bool FeeGenerated { get; init; }
    public decimal? FeeAmountSar { get; init; }
    public string CreatedByUserId { get; init; } = "";
    public string CreatedByName { get; init; } = "";
    public DateTime CreatedAtUtc { get; init; }
    public DateTime UpdatedAtUtc { get; init; }
    public Guid? OperationsTaskId { get; init; }
    public IReadOnlyList<KeyEnvelopeAssignmentDto> Assignments { get; init; } = [];
    public IReadOnlyList<KeyEnvelopeHandoffDto> Handoffs { get; init; } = [];
    public IReadOnlyList<KeyEnvelopeTimelineEntryDto> Timeline { get; init; } = [];
    public IReadOnlyList<KeyEnvelopeLinkedPropertyDto> LinkedProperties { get; init; } = [];
}

public class KeyEnvelopeFeeReportRowDto
{
    public Guid EnvelopeId { get; init; }
    public string RequestNumber { get; init; } = "";
    public string Court { get; init; } = "";
    public string Circuit { get; init; } = "";
    public Guid? PhotoAttachmentId { get; init; }
    public Guid? ReceiptAttachmentId { get; init; }
    public decimal FeeAmountSar { get; init; }
    public string CollectionStatus { get; init; } = "open";
    public string? InvoiceReference { get; init; }
    public DateTime? CollectedAtUtc { get; init; }
    public string CreatedByName { get; init; } = "";
    public DateTime CreatedAtUtc { get; init; }
}

public class MarkKeyReceiptFeeCollectedRequest
{
    [MaxLength(128)]
    public string? InvoiceReference { get; init; }
}

public class KeyEnvelopeAssignmentInput
{
    [Required, MaxLength(128)]
    public string DeedNumber { get; init; } = "";
    public Guid? PropertyId { get; init; }
    [MaxLength(2000)]
    public string? Notes { get; init; }
}

public class CreateKeyEnvelopeRequest
{
    [Required, MaxLength(128)]
    public string RequestNumber { get; init; } = "";
    [Required, MaxLength(256)]
    public string Court { get; init; } = "";
    [Required, MaxLength(150)]
    public string Circuit { get; init; } = "";
    [Range(0, 9999)]
    public int KeysCountLabeled { get; init; }
    [Range(0, 9999)]
    public int KeysCountActual { get; init; }
    /// <summary>court | missing | third_party</summary>
    [MaxLength(32)]
    public string ReceiveScenario { get; init; } = "court";
    public Guid? ReceiptAttachmentId { get; init; }
    public Guid? PhotoAttachmentId { get; init; }
    public Guid? ThirdPartyLetterAttachmentId { get; init; }
    [MaxLength(1000)]
    public string? ContactPhones { get; init; }
    [MaxLength(4000)]
    public string? Notes { get; init; }
    /// <summary>Optional link to the court_visit operations task.</summary>
    public Guid? OperationsTaskId { get; init; }
    public IReadOnlyList<KeyEnvelopeAssignmentInput>? Assignments { get; init; }
}

public class AddKeyEnvelopeAssignmentRequest
{
    [Required, MaxLength(128)]
    public string DeedNumber { get; init; } = "";
    public Guid? PropertyId { get; init; }
    [MaxLength(2000)]
    public string? Notes { get; init; }
}

public class ConfirmKeyAssignmentRequest
{
    /// <summary>matched | partial | unmatched | unmatched_inspected | missing</summary>
    [Required, MaxLength(32)]
    public string Status { get; init; } = "";
    [MaxLength(2000)]
    public string? Notes { get; init; }
}

public class CreateKeyEnvelopeHandoffRequest
{
    /// <summary>internal | external | receive_back | return_court</summary>
    [Required, MaxLength(32)]
    public string Kind { get; init; } = "";
    [Required, MaxLength(256)]
    public string FromParty { get; init; } = "";
    [Required, MaxLength(256)]
    public string ToParty { get; init; } = "";
    [MaxLength(450)]
    public string? ToUserId { get; init; }
    [MaxLength(128)]
    public string? LetterNumber { get; init; }
    public Guid? LetterAttachmentId { get; init; }
    [MaxLength(2000)]
    public string? Notes { get; init; }
}

public class PropertyCourtAccessDto
{
    public Guid Id { get; init; }
    public Guid PropertyId { get; init; }
    public string PoNumber { get; init; } = "";
    public string DeedNumber { get; init; } = "";
    public string RequestNumber { get; init; } = "";
    public bool HasEnablingLetter { get; init; }
    public Guid? EnablingLetterAttachmentId { get; init; }
    public bool HasEvictionNotice { get; init; }
    public Guid? EvictionNoticeAttachmentId { get; init; }
    public string StudyHoldStatus { get; init; } = "none";
    public string? ContactPhones { get; init; }
    public string? Notes { get; init; }
    public string UpdatedByName { get; init; } = "";
    public DateTime UpdatedAtUtc { get; init; }
}

public class UpsertPropertyCourtAccessRequest
{
    [Required]
    public Guid PropertyId { get; init; }
    public bool HasEnablingLetter { get; init; }
    public Guid? EnablingLetterAttachmentId { get; init; }
    public bool HasEvictionNotice { get; init; }
    public Guid? EvictionNoticeAttachmentId { get; init; }
    [MaxLength(1000)]
    public string? ContactPhones { get; init; }
    [MaxLength(4000)]
    public string? Notes { get; init; }
}
