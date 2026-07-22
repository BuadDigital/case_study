using System.ComponentModel.DataAnnotations;

namespace RealEstateEval.Application.Contracts;

public class OperationsTaskLetterRowDto
{
    public string Po { get; set; } = "";
    public string Deed { get; set; } = "";
    public string Owner { get; set; } = "";
    public string Request { get; set; } = "";
    public string Court { get; set; } = "";
    public string Circuit { get; set; } = "";
}

public class OperationsTaskCommentFileDto
{
    public string Name { get; set; } = "";
    public string Size { get; set; } = "";
}

public class OperationsTaskCommentDto
{
    public string Who { get; set; } = "system";
    public string At { get; set; } = "";
    public string Text { get; set; } = "";
    public string? Kind { get; set; }
    public IReadOnlyList<OperationsTaskCommentFileDto> Files { get; set; } = [];
}

public class OperationsTaskReminderDto
{
    public string At { get; set; } = "";
    public bool Auto { get; set; }
}

public class OperationsTaskCourtVisitDeedStatementDto
{
    public string Deed { get; set; } = "";
    public string Text { get; set; } = "";
}

public class OperationsTaskCourtVisitContactDto
{
    /// <summary>property | deed number</summary>
    public string Scope { get; set; } = "property";
    public string Name { get; set; } = "";
    public string? Role { get; set; }
    public string? Phone { get; set; }
    public string? Note { get; set; }
}

/// <summary>
/// Court-visit close outcome. Kind: received | other_party | none | other.
/// </summary>
public class OperationsTaskCourtVisitResultDto
{
    public string Kind { get; set; } = "";
    /// <summary>Required when Kind = other.</summary>
    public string? Other { get; set; }
    /// <summary>Unified court statement at request level.</summary>
    public string? Statement { get; set; }
    public IReadOnlyList<OperationsTaskCourtVisitDeedStatementDto> PerDeed { get; set; } = [];
    public IReadOnlyList<OperationsTaskCourtVisitContactDto> Contacts { get; set; } = [];
}

public class OperationsTaskDto
{
    public string Id { get; set; } = "";
    public string DisplayId { get; set; } = "";
    public string Type { get; set; } = "";
    public string Title { get; set; } = "";
    public string? Description { get; set; }
    public string Scope { get; set; } = "";
    public IReadOnlyList<string> Deeds { get; set; } = [];
    public string? PoNumber { get; set; }
    public string AssigneeId { get; set; } = "";
    public string AssigneeName { get; set; } = "";
    public string CreatedBy { get; set; } = "";
    public string CreatedByName { get; set; } = "";
    public string Status { get; set; } = "";
    public string? PrevStatus { get; set; }
    public string Priority { get; set; } = "";
    public string DueAt { get; set; } = "";
    public string CreatedAt { get; set; } = "";
    public string UpdatedAt { get; set; } = "";
    public string? Reference { get; set; }
    public IReadOnlyList<OperationsTaskLetterRowDto> LetterRows { get; set; } = [];
    public IReadOnlyList<OperationsTaskCommentDto> Comments { get; set; } = [];
    public IReadOnlyList<OperationsTaskReminderDto> Reminders { get; set; } = [];
    public OperationsTaskCourtVisitResultDto? CourtVisitResult { get; set; }
    public string? PauseReason { get; set; }
    public string? PausedAt { get; set; }
    public string? OriginalAssigneeId { get; set; }
    public string? OriginalAssigneeName { get; set; }
    public string? CreditAssigneeId { get; set; }
    public string? CreditAssigneeName { get; set; }
    /// <summary>ISO when assignee confirmed receipt; null = بانتظار المنفّذ.</summary>
    public string? ReceiptConfirmedAt { get; set; }
    /// <summary>Required reason when status is cancelled.</summary>
    public string? CancelReason { get; set; }
    /// <summary>Linked key envelope id when registered against this task.</summary>
    public string? LinkedEnvelopeId { get; set; }
    /// <summary>Visit fee stamped when court_visit completed (null if not generated).</summary>
    public decimal? VisitFeeAmountSar { get; set; }
}

/// <summary>أتعاب الزيارة report row (ops court_visit complete).</summary>
public class CourtVisitFeeReportRowDto
{
    public Guid Id { get; set; }
    public Guid OperationsTaskId { get; set; }
    public string TaskDisplayId { get; set; } = "";
    public string? PoNumber { get; set; }
    public string CreditAssigneeId { get; set; } = "";
    public string CreditAssigneeName { get; set; } = "";
    public decimal AmountSar { get; set; }
    public string Status { get; set; } = "";
    public DateTime CreatedAtUtc { get; set; }
}

public class CreateOperationsTaskRequest
{
    [Required]
    public string Type { get; set; } = "";

    [Required]
    [MaxLength(500)]
    public string Title { get; set; } = "";

    [MaxLength(4000)]
    public string? Description { get; set; }

    [Required]
    public string Scope { get; set; } = "general";

    public IReadOnlyList<string>? Deeds { get; set; }

    public string? PoNumber { get; set; }

    [Required]
    public string AssigneeId { get; set; } = "";

    public string? AssigneeName { get; set; }

    public string Priority { get; set; } = "medium";

    public DateTime? DueAtUtc { get; set; }

    public IReadOnlyList<OperationsTaskLetterRowDto>? LetterRows { get; set; }
}

public class PatchOperationsTaskRequest
{
    public string? Status { get; set; }
    public string? Priority { get; set; }
    public DateTime? DueAtUtc { get; set; }
    public string? Title { get; set; }
    public string? Description { get; set; }
    /// <summary>Required when completing a court_visit task.</summary>
    public OperationsTaskCourtVisitResultDto? CourtVisitResult { get; set; }
    /// <summary>Required when Status = paused.</summary>
    [MaxLength(2000)]
    public string? PauseReason { get; set; }
    /// <summary>Required when Status = cancelled.</summary>
    [MaxLength(2000)]
    public string? CancelReason { get; set; }
    /// <summary>Execution-credit assignee when closing a reassigned task.</summary>
    public string? CreditAssigneeId { get; set; }
    public string? CreditAssigneeName { get; set; }
}

public class ReassignOperationsTaskRequest
{
    [Required]
    public string AssigneeId { get; set; } = "";

    public string? AssigneeName { get; set; }

    public DateTime? DueAtUtc { get; set; }

    [Required]
    [MaxLength(2000)]
    public string Reason { get; set; } = "";
}

public class RemindOperationsTaskRequest
{
    /// <summary>When true, marks the reminder as scheduler-generated.</summary>
    public bool Auto { get; set; }
}

public class AddOperationsTaskCommentRequest
{
    [MaxLength(4000)]
    public string Text { get; set; } = "";

    public string? Kind { get; set; }

    public IReadOnlyList<OperationsTaskCommentFileDto>? Files { get; set; }
}
