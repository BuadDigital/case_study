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
