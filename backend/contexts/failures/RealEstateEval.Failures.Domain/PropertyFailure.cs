namespace RealEstateEval.Failures.Domain;

/// <summary>
/// Property failure (obstruction). Status transitions are owned here; side effects (timeline,
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
    /// <summary>Work-order property id (case_study.WorkOrderProperties.Id).</summary>
    public Guid PropertyId { get; private set; }
    public string DeedNumber { get; private set; } = "";
    public string Title { get; private set; } = "";
    public string ProblemTypeId { get; private set; } = "";
 /// <summary>suspected | internal</summary>
    public string Severity { get; private set; } = PropertyFailureSeverity.Internal;
    public string RaisedByRole { get; private set; } = "";
    public string InternalNote { get; private set; } = "";
 /// <summary>The specialist's explanation when escalating to the supervisor (the latest escalation).</summary>
    public string EscalationNote { get; private set; } = "";
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
 /// <summary>
 /// When the case specialist lifted the engineering-survey freeze this failure puts on the property.
 /// Null while the freeze stands. The failure itself stays active; only the survey gate reads this.
 /// </summary>
    public DateTime? SurveyFreezeLiftedAtUtc { get; private set; }
 /// <summary>User id of the specialist who lifted the survey freeze.</summary>
    public string? SurveyFreezeLiftedByUserId { get; private set; }
 /// <summary>The reason recorded with the lift (at least ten characters, enforced by the rule).</summary>
    public string? SurveyFreezeLiftReason { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }
    public DateTime UpdatedAtUtc { get; private set; }

    public static PropertyFailure Create(
        Guid id,
        string poNumber,
        Guid propertyId,
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
            PropertyId = propertyId,
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
        if (Status != PropertyFailureStatus.Internal || Severity != PropertyFailureSeverity.Suspected)
            return false;
        Severity = PropertyFailureSeverity.Internal;
        UpdatedAtUtc = nowUtc;
        return true;
    }

 /// <summary>«تصعيد إلى المشرف» — the specialist hands an internal or returned failure up for review.</summary>
 /// <remarks>
 /// How it works: from <c>internal</c> or <c>returned</c> only, the status becomes <c>review</c>
 /// and the specialist's explanation is stored trimmed in <see cref="EscalationNote"/>, where the
 /// supervisor reads it as «سبب التصعيد». Returns false and changes nothing from any other status.
 ///
 /// Edge cases: a failure escalated again after a return overwrites the note with the latest one.
 /// A blank note is refused one level up (the service and the controller's note validator) — the
 /// escalation used to carry no explanation at all; now it must.
 /// A possible failure also has status <c>internal</c>, so the domain would accept it; the screen
 /// offers «تأكيد تعذّر داخلي» instead of the escalate button for it.
 /// </remarks>
    public bool TrySubmitForReview(string escalationNote, DateTime nowUtc)
    {
        if (Status is not (PropertyFailureStatus.Internal or PropertyFailureStatus.Returned))
            return false;
        Status = PropertyFailureStatus.Review;
        EscalationNote = escalationNote.Trim();
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

 /// <summary>
 /// Lifts the engineering-survey freeze while the failure stays active. Idempotent: an already
 /// lifted failure keeps its first lift (who, when, why) and reports false; a failure that is no
 /// longer active has nothing to lift.
 /// </summary>
    public bool LiftSurveyFreeze(string? userId, string reason, DateTime nowUtc)
    {
        if (SurveyFreezeLiftedAtUtc is not null) return false;
        if (!PropertyFailureStatus.Active.Contains(Status)) return false;
        SurveyFreezeLiftedAtUtc = nowUtc;
        SurveyFreezeLiftedByUserId = string.IsNullOrWhiteSpace(userId) ? null : userId.Trim();
        SurveyFreezeLiftReason = reason.Trim();
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

 /// <summary>
 /// «التعذر النهائي عن المعاملة» — the supervisor records the final failure from any open stage
 /// (possible, internal, returned, escalated); a possible failure is confirmed on the way.
 /// Resolved, suspended and already-final failures are left alone.
 /// </summary>
 /// <remarks>
 /// How it works: when the status is active and not yet <c>approved</c>, it becomes
 /// <c>approved</c>, the severity <c>internal</c>, and the supervisor's reason the trimmed
 /// <see cref="FinalNote"/>. Returns false and changes nothing otherwise.
 ///
 /// Edge cases: unlike <see cref="TryApprove"/> it does not require <c>review</c> — the final
 /// failure comes from the centre's decision and may land before the specialist escalated. The
 /// false on an already-final failure is what lets a repeated request finalize nothing and be
 /// answered «المعاملة متعذّرة نهائياً من قبل».
 /// </remarks>
    public bool TryFinalize(string finalNote, DateTime nowUtc)
    {
        if (!PropertyFailureStatus.IsActive(Status) || Status == PropertyFailureStatus.Approved)
            return false;
        Status = PropertyFailureStatus.Approved;
        Severity = PropertyFailureSeverity.Internal;
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
        Guid propertyId,
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
        string continueInstructions = "",
        DateTime? surveyFreezeLiftedAtUtc = null,
        string? surveyFreezeLiftedByUserId = null,
        string? surveyFreezeLiftReason = null,
        string escalationNote = "") =>
        new()
        {
            EscalationNote = escalationNote,
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
            SurveyFreezeLiftedAtUtc = surveyFreezeLiftedAtUtc,
            SurveyFreezeLiftedByUserId = surveyFreezeLiftedByUserId,
            SurveyFreezeLiftReason = surveyFreezeLiftReason,
            CreatedAtUtc = createdAtUtc,
            UpdatedAtUtc = updatedAtUtc,
        };
}
