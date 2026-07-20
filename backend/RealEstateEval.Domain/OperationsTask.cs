namespace RealEstateEval.Domain;

/// <summary>Operational task (طبقة المهام) — distinct from workflow party tasks.</summary>
public class OperationsTask
{
    public Guid Id { get; set; }
    /// <summary>Human-readable id, e.g. T-2026-0041.</summary>
    public string DisplayId { get; set; } = "";
    public string Type { get; set; } = "general";
    public string Title { get; set; } = "";
    public string? Description { get; set; }
    public string Scope { get; set; } = "general";
    /// <summary>JSON array of deed numbers.</summary>
    public string? DeedsJson { get; set; }
    public string? PoNumber { get; set; }
    public string AssigneeId { get; set; } = "";
    public string AssigneeName { get; set; } = "";
    public string CreatedBy { get; set; } = "";
    public string CreatedByName { get; set; } = "";
    public string Status { get; set; } = "created";
    public string? PrevStatus { get; set; }
    public string Priority { get; set; } = "medium";
    public DateTime DueAtUtc { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
    /// <summary>Delegation letter reference for court_visit tasks.</summary>
    public string? Reference { get; set; }
    /// <summary>JSON snapshot of letter rows for court_visit.</summary>
    public string? LetterRowsJson { get; set; }
    /// <summary>JSON array of task comments.</summary>
    public string? CommentsJson { get; set; }
    /// <summary>JSON array of reminder log entries.</summary>
    public string? RemindersJson { get; set; }
}

public class OperationsTaskSequence
{
    public Guid Id { get; set; }
    public int Year { get; set; }
    public int NextSeq { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
}
