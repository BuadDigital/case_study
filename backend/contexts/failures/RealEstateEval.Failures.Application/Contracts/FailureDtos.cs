namespace RealEstateEval.Failures.Application.Contracts;

public class FailureRecordDto
{
    public string Id { get; set; } = "";
    public string PoNumber { get; set; } = "";
    public string PropertyId { get; set; } = "";
    public string DeedNumber { get; set; } = "";
    public string Title { get; set; } = "";
    public string ProblemTypeId { get; set; } = "";
    public string Severity { get; set; } = "internal";
    public string RaisedByRole { get; set; } = "";
    public string InternalNote { get; set; } = "";
    /// <summary>The specialist's explanation when escalating to the supervisor.</summary>
    public string EscalationNote { get; set; } = "";
    public string FinalNote { get; set; } = "";
    public string ResolutionReason { get; set; } = "";
    public string ContinueInstructions { get; set; } = "";
    public string Status { get; set; } = "internal";
    public string Specialist { get; set; } = "";
    public string CreatedAt { get; set; } = "";
    public string UpdatedAt { get; set; } = "";
    public string? SuspendedAt { get; set; }
    public string? SuspendedByUserId { get; set; }
    public string? SurveyFreezeLiftedAt { get; set; }
    public string? SurveyFreezeLiftReason { get; set; }
    /// <summary>The property's transaction number (PR-… or TMP-…); null when the property is not found.</summary>
    public string? TransactionNumber { get; set; }
    /// <summary>Deeds in that transaction (1 for an ordinary property).</summary>
    public int TransactionDeedCount { get; set; } = 1;
    /// <summary>The company's case specialist on the deed («الأخصائي»); null until one is assigned.</summary>
    public string? CaseSpecialistName { get; set; }
}

public class CreateFailureRequest
{
    public string PoNumber { get; set; } = "";
    public string PropertyId { get; set; } = "";
    public string DeedNumber { get; set; } = "";
    public string ProblemTypeId { get; set; } = "";
    public string Severity { get; set; } = "internal";
    public string? RaisedByRole { get; set; }
    public string? Title { get; set; }
    public string? InternalNote { get; set; }
    public string Specialist { get; set; } = "";
}

public class BourseObstructionRequest
{
    public string PoNumber { get; set; } = "";
    public string PropertyId { get; set; } = "";
    public string DeedNumber { get; set; } = "";
    public string Reason { get; set; } = "";
    public string Specialist { get; set; } = "";
}

public class ResolveFailureRequest
{
    public string ResolutionReason { get; set; } = "";
    public string ContinueInstructions { get; set; } = "";
}

/// <summary>
/// «التعذر النهائي عن المعاملة» from the property ⋮ menu or the supervisor's approve button.
/// Lands on every live deed of the deed's transaction.
/// </summary>
public class FinalFailureRequest
{
    public string PoNumber { get; set; } = "";
    public string PropertyId { get; set; } = "";
    /// <summary>Required only for a deed with no open failure to finalize.</summary>
    public string? ProblemTypeId { get; set; }
    /// <summary>The problem type's label, stored as the new failure's title.</summary>
    public string? Title { get; set; }
    /// <summary>The supervisor's reason — stored as the final note on every deed.</summary>
    public string Reason { get; set; } = "";
    /// <summary>Notify the parties holding tasks on the deeds; false stops them silently.</summary>
    public bool NotifyParties { get; set; }
}

public class FailureNoteRequest
{
    public string Note { get; set; } = "";
}

public class FailurePropertyGatesDto
{
    public bool HasActive { get; set; }
    public bool HasBlocking { get; set; }

    /// <summary>
    /// An active failure whose engineering-survey freeze has not been lifted. Nullable on the wire so
    /// a newer client reading an older Failures host falls back to <see cref="HasActive"/>.
    /// </summary>
    public bool? SurveyFrozen { get; set; }
}

public class EnsureSystemInternalFailureRequest
{
    public string PoNumber { get; set; } = "";
    public string PropertyId { get; set; } = "";
    public string DeedNumber { get; set; } = "";
    public string ProblemTypeId { get; set; } = "";
    public string Title { get; set; } = "";
    public string Note { get; set; } = "";
    public string Specialist { get; set; } = "";
}

public class PropertyFailureHoldRequest
{
    public string PoNumber { get; set; } = "";
    public string PropertyId { get; set; } = "";
    public string DeedNumber { get; set; } = "";
    public string Specialist { get; set; } = "";
}

public class ResolveEvictionHoldRequest
{
    public string PoNumber { get; set; } = "";
    public string PropertyId { get; set; } = "";
    public string Actor { get; set; } = "";
}

public class LiftSurveyFreezeRequest
{
    public string PoNumber { get; set; } = "";
    public string PropertyId { get; set; } = "";
    public string Reason { get; set; } = "";
}

public class LiftSurveyFreezeResultDto
{
    /// <summary>How many active failures of the property had their survey freeze lifted by this call.</summary>
    public int Lifted { get; set; }
}
