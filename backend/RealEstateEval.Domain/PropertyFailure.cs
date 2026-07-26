namespace RealEstateEval.Domain;

/// <summary>Property failure (تعذر) — obstruction / supervisor review workflow.</summary>
public class PropertyFailure
{
    public Guid Id { get; set; }
    public string PoNumber { get; set; } = "";
    /// <summary>Frontend property key — usually work-order property Guid string.</summary>
    public string PropertyId { get; set; } = "";
    public string DeedNumber { get; set; } = "";
    public string Title { get; set; } = "";
    public string ProblemTypeId { get; set; } = "";
    /// <summary>suspected | internal</summary>
    public string Severity { get; set; } = "internal";
    public string RaisedByRole { get; set; } = "";
    public string InternalNote { get; set; } = "";
    public string FinalNote { get; set; } = "";
    public string ResolutionReason { get; set; } = "";
    public string ContinueInstructions { get; set; } = "";
    /// <summary>internal | review | approved | returned | resolved | suspended</summary>
    public string Status { get; set; } = "internal";
    public string Specialist { get; set; } = "";
    /// <summary>When the failure was suspended. Null until suspend (or for rows predating this column).</summary>
    public DateTime? SuspendedAtUtc { get; set; }
    /// <summary>User id of who suspended. Null for historical rows that predate capture.</summary>
    public string? SuspendedByUserId { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
}
