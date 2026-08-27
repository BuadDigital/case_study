namespace RealEstateEval.Failures.Domain;

/// <summary>
/// Property failure (تعذر). Status transitions are owned here; side effects (timeline,
/// task obstruction, deed status) stay in the application service.
/// </summary>
public class PropertyFailure
{
 /// <summary>For EF materialization and factories.</summary>
    private PropertyFailure()
    {
    }

    public Guid Id { get; private set; }
    public string PoNumber { get; private set; } = "";
 /// <summary>Frontend property key — usually work-order property Guid string.</summary>
    public string PropertyId { get; private set; } = "";
    public string DeedNumber { get; private set; } = "";
    public string Title { get; private set; } = "";
    public string ProblemTypeId { get; private set; } = "";
 /// <summary>suspected | internal</summary>
    public string Severity { get; private set; } = "internal";
    public string RaisedByRole { get; private set; } = "";
    public string InternalNote { get; private set; } = "";
    public string FinalNote { get; private set; } = "";
    public string ResolutionReason { get; private set; } = "";
    public string ContinueInstructions { get; private set; } = "";
 /// <summary>internal | review | approved | returned | resolved | suspended</summary>
    public string Status { get; private set; } = PropertyFailureStatus.Internal;
    public string Specialist { get; private set; } = "";
 /// <summary>When the failure was suspended. Null until suspend (or for rows predating this column).</summary>
    public DateTime? SuspendedAtUtc { get; private set; }
 /// <summary>User id of who suspended. Null for historical rows that predate capture.</summary>
    public string? SuspendedByUserId { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }
    public DateTime UpdatedAtUtc { get; private set; }

    public static PropertyFailure Create(
        Guid id,
        string poNumber,
        string propertyId,
        string deedNumber,
        string title,
        string problemTypeId,
        string severity,
        string raisedByRole,
        string internalNote,
        string specialist,
        DateTime nowUtc) =>
        new()
        {
            Id = id,
            PoNumber = poNumber.Trim(),
            PropertyId = propertyId.Trim(),
            DeedNumber = deedNumber.Trim(),
            Title = title.Trim(),
            ProblemTypeId = problemTypeId.Trim(),
            Severity = severity,
            RaisedByRole = raisedByRole,
            InternalNote = internalNote,
            FinalNote = "",
            ResolutionReason = "",
            ContinueInstructions = "",
            Status = PropertyFailureStatus.Internal,
            Specialist = specialist,
            CreatedAtUtc = nowUtc,
            UpdatedAtUtc = nowUtc,
        };

    public bool TryUpgradeToInternal(DateTime nowUtc)
    {
        if (Status != PropertyFailureStatus.Internal || Severity != "suspected")
            return false;
        Severity = "internal";
        UpdatedAtUtc = nowUtc;
        return true;
    }

    public bool TrySubmitForReview(DateTime nowUtc)
    {
        if (Status is not (PropertyFailureStatus.Internal or PropertyFailureStatus.Returned))
            return false;
        Status = PropertyFailureStatus.Review;
        UpdatedAtUtc = nowUtc;
        return true;
    }

    public bool TrySuspend(string note, string? actorUserId, DateTime nowUtc)
    {
        if (Status != PropertyFailureStatus.Review)
            return false;
        Status = PropertyFailureStatus.Suspended;
        FinalNote = note.Trim();
        SuspendedAtUtc = nowUtc;
        SuspendedByUserId = string.IsNullOrWhiteSpace(actorUserId) ? null : actorUserId.Trim();
        UpdatedAtUtc = nowUtc;
        return true;
    }

    public bool TryResolve(string resolutionReason, string continueInstructions, DateTime nowUtc)
    {
        if (!PropertyFailureStatus.IsActive(Status) || Status == PropertyFailureStatus.Approved)
            return false;
        Status = PropertyFailureStatus.Resolved;
        ResolutionReason = resolutionReason.Trim();
        ContinueInstructions = continueInstructions.Trim();
        UpdatedAtUtc = nowUtc;
        return true;
    }

    public bool TryApprove(string finalNote, DateTime nowUtc)
    {
        if (Status != PropertyFailureStatus.Review)
            return false;
        Status = PropertyFailureStatus.Approved;
        FinalNote = finalNote.Trim();
        UpdatedAtUtc = nowUtc;
        return true;
    }

    public bool TryReturn(string finalNote, DateTime nowUtc)
    {
        if (Status != PropertyFailureStatus.Review)
            return false;
        Status = PropertyFailureStatus.Returned;
        FinalNote = finalNote.Trim();
        UpdatedAtUtc = nowUtc;
        return true;
    }

 /// <summary>Park an open non-terminal failure as suspended (system hold paths).</summary>
    public bool TryForceSuspend(string finalNote, DateTime nowUtc)
    {
        if (Status is PropertyFailureStatus.Resolved or PropertyFailureStatus.Approved
            or PropertyFailureStatus.Suspended)
            return false;
        Status = PropertyFailureStatus.Suspended;
        FinalNote = finalNote.Trim();
        SuspendedAtUtc = nowUtc;
        UpdatedAtUtc = nowUtc;
        return true;
    }

 /// <summary>System-driven field refresh while a hold remains open (eviction retarget).</summary>
    public void RefreshOpenHold(
        string problemTypeId,
        string title,
        string finalNote,
        DateTime nowUtc)
    {
        ProblemTypeId = problemTypeId.Trim();
        Title = title.Trim();
        FinalNote = finalNote.Trim();
        UpdatedAtUtc = nowUtc;
    }

 /// <summary>
 /// Resolve any open failure regardless of active-list rules (system holds).
 /// Approved / already resolved rows stay final.
 /// </summary>
    public bool TrySystemResolve(
        string resolutionReason,
        string continueInstructions,
        DateTime nowUtc,
        string? finalNoteIfEmpty = null)
    {
        if (Status is PropertyFailureStatus.Resolved or PropertyFailureStatus.Approved)
            return false;
        Status = PropertyFailureStatus.Resolved;
        ResolutionReason = resolutionReason.Trim();
        ContinueInstructions = continueInstructions.Trim();
        if (!string.IsNullOrWhiteSpace(finalNoteIfEmpty) && string.IsNullOrWhiteSpace(FinalNote))
            FinalNote = finalNoteIfEmpty.Trim();
        UpdatedAtUtc = nowUtc;
        return true;
    }

 /// <summary>
 /// Test and historical seed path. Production writes go through <see cref="Create"/> and
 /// transition methods so the status machine stays centralized.
 /// </summary>
    public static PropertyFailure Reconstitute(
        Guid id,
        string poNumber,
        string propertyId,
        string deedNumber,
        string title,
        string problemTypeId,
        string severity,
        string raisedByRole,
        string internalNote,
        string finalNote,
        string status,
        string specialist,
        DateTime createdAtUtc,
        DateTime updatedAtUtc,
        DateTime? suspendedAtUtc = null,
        string? suspendedByUserId = null,
        string resolutionReason = "",
        string continueInstructions = "") =>
        new()
        {
            Id = id,
            PoNumber = poNumber,
            PropertyId = propertyId,
            DeedNumber = deedNumber,
            Title = title,
            ProblemTypeId = problemTypeId,
            Severity = severity,
            RaisedByRole = raisedByRole,
            InternalNote = internalNote,
            FinalNote = finalNote,
            ResolutionReason = resolutionReason,
            ContinueInstructions = continueInstructions,
            Status = status,
            Specialist = specialist,
            SuspendedAtUtc = suspendedAtUtc,
            SuspendedByUserId = suspendedByUserId,
            CreatedAtUtc = createdAtUtc,
            UpdatedAtUtc = updatedAtUtc,
        };
}
