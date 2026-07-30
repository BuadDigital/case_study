namespace RealEstateEval.Domain;

/// <summary>
/// Operational task (طبقة المهام) — distinct from workflow party tasks. The status machine is
/// owned here: created → in progress → completed, with pause and cancel as supervisor exits and
/// nothing leaving a terminal status.
/// </summary>
public class OperationsTask
{
    /// <summary>For EF materialization and <see cref="Create"/>.</summary>
    private OperationsTask()
    {
    }

    public Guid Id { get; private set; }
    /// <summary>Human-readable id, e.g. T-2026-0041.</summary>
    public string DisplayId { get; private set; } = "";
    public OperationsTaskType Type { get; private set; } = OperationsTaskType.General;
    public string Title { get; private set; } = "";
    public string? Description { get; private set; }
    public OperationsTaskScope Scope { get; private set; } = OperationsTaskScope.General;
    /// <summary>JSON array of deed numbers.</summary>
    public string? DeedsJson { get; private set; }
    public string? PoNumber { get; private set; }
    public string AssigneeId { get; private set; } = "";
    public string AssigneeName { get; private set; } = "";
    public string CreatedBy { get; private set; } = "";
    public string CreatedByName { get; private set; } = "";
    public OperationsTaskStatus Status { get; private set; } = OperationsTaskStatus.Created;
    public OperationsTaskStatus? PrevStatus { get; private set; }
    public OperationsTaskPriority Priority { get; private set; } = OperationsTaskPriority.Medium;
    public DateTime DueAtUtc { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }
    public DateTime UpdatedAtUtc { get; private set; }
    /// <summary>Delegation letter reference for court-visit tasks.</summary>
    public string? Reference { get; private set; }
    /// <summary>JSON snapshot of letter rows for court visits.</summary>
    public string? LetterRowsJson { get; private set; }
    /// <summary>JSON array of task comments.</summary>
    public string? CommentsJson { get; private set; }
    /// <summary>JSON array of reminder log entries.</summary>
    public string? RemindersJson { get; private set; }
    /// <summary>JSON court-visit close outcome (kind, statement, contacts, …).</summary>
    public string? CourtVisitResultJson { get; private set; }
    /// <summary>Required when status becomes paused.</summary>
    public string? PauseReason { get; private set; }
    /// <summary>UTC when the task was last paused.</summary>
    public DateTime? PausedAtUtc { get; private set; }
    /// <summary>Last daily over-limit pause reminder (UTC).</summary>
    public DateTime? PauseOverLimitRemindedAtUtc { get; private set; }
    /// <summary>First assignee before any reassignment (execution-credit default).</summary>
    public string? OriginalAssigneeId { get; private set; }
    public string? OriginalAssigneeName { get; private set; }
    /// <summary>Who receives execution credit at close (defaults to original / current assignee).</summary>
    public string? CreditAssigneeId { get; private set; }
    public string? CreditAssigneeName { get; private set; }
    /// <summary>UTC when the assignee confirmed receipt («تأكيد الاستلام»).</summary>
    public DateTime? ReceiptConfirmedAtUtc { get; private set; }
    /// <summary>Required when status becomes cancelled.</summary>
    public string? CancelReason { get; private set; }

    public bool IsTerminal => Status.IsTerminal();

    public bool IsCourtVisit => Type == OperationsTaskType.CourtVisit;

    public static OperationsTask Create(
        Guid id,
        string displayId,
        OperationsTaskType type,
        string title,
        OperationsTaskScope scope,
        string assigneeId,
        string createdBy,
        OperationsTaskPriority priority,
        DateTime dueAtUtc,
        DateTime nowUtc,
        string? description = null,
        string? deedsJson = null,
        string? poNumber = null,
        string? assigneeName = null,
        string? createdByName = null,
        string? reference = null,
        string? letterRowsJson = null,
        string? commentsJson = null) => new()
        {
            Id = id,
            DisplayId = displayId,
            Type = type,
            Title = title,
            Description = description,
            Scope = scope,
            DeedsJson = deedsJson,
            PoNumber = poNumber,
            AssigneeId = assigneeId,
            AssigneeName = assigneeName ?? "",
            CreatedBy = createdBy,
            CreatedByName = createdByName ?? "",
            Status = OperationsTaskStatus.Created,
            Priority = priority,
            DueAtUtc = dueAtUtc,
            CreatedAtUtc = nowUtc,
            UpdatedAtUtc = nowUtc,
            Reference = reference,
            LetterRowsJson = letterRowsJson,
            CommentsJson = commentsJson,
        };

    /// <summary>
    /// The legal status edges. Resume is always <see cref="OperationsTaskStatus.InProgress"/> —
    /// never <see cref="PrevStatus"/>, because pausing from "created" would otherwise resume to
    /// "created" and be rejected here.
    /// </summary>
    public static bool IsLegalTransition(OperationsTaskStatus from, OperationsTaskStatus to) =>
        (from, to) switch
        {
            (OperationsTaskStatus.Created, OperationsTaskStatus.InProgress) => true,
            (OperationsTaskStatus.Paused, OperationsTaskStatus.InProgress) => true,
            (OperationsTaskStatus.InProgress, OperationsTaskStatus.Completed) => true,
            (OperationsTaskStatus.Paused, OperationsTaskStatus.Completed) => true,
            (OperationsTaskStatus.Created, OperationsTaskStatus.Paused) => true,
            (OperationsTaskStatus.InProgress, OperationsTaskStatus.Paused) => true,
            (OperationsTaskStatus.Created, OperationsTaskStatus.Cancelled) => true,
            (OperationsTaskStatus.InProgress, OperationsTaskStatus.Cancelled) => true,
            (OperationsTaskStatus.Paused, OperationsTaskStatus.Cancelled) => true,
            _ => false,
        };

    public bool CanTransitionTo(OperationsTaskStatus next) =>
        !IsTerminal && IsLegalTransition(Status, next);

    /// <summary>
    /// Moves the task to <paramref name="next"/> and applies everything that hangs off the
    /// transition: pause bookkeeping, cancel reason, receipt confirmation. Returns the status the
    /// task came from so the caller can log it.
    /// </summary>
    public OperationsTaskStatus TransitionTo(
        OperationsTaskStatus next,
        DateTime nowUtc,
        string? pauseReason = null,
        string? cancelReason = null)
    {
        if (!CanTransitionTo(next))
            throw new InvalidOperationException($"Illegal operations task transition {Status} → {next}.");

        if (next == OperationsTaskStatus.Paused && string.IsNullOrWhiteSpace(pauseReason))
            throw new InvalidOperationException("Pausing an operations task requires a reason.");

        if (next == OperationsTaskStatus.Cancelled && string.IsNullOrWhiteSpace(cancelReason))
            throw new InvalidOperationException("Cancelling an operations task requires a reason.");

        var from = Status;

        if (next == OperationsTaskStatus.Paused)
        {
            PrevStatus = from;
            PauseReason = pauseReason!.Trim();
            PausedAtUtc = nowUtc;
            PauseOverLimitRemindedAtUtc = null;
        }
        else if (from == OperationsTaskStatus.Paused)
        {
            PausedAtUtc = null;
            PauseOverLimitRemindedAtUtc = null;
        }

        if (next == OperationsTaskStatus.Cancelled)
            CancelReason = cancelReason!.Trim();

        // Entering execution is also the receipt confirmation, including a resume after a
        // pause taken straight from "created".
        if (next == OperationsTaskStatus.InProgress && ReceiptConfirmedAtUtc is null)
            ReceiptConfirmedAtUtc = nowUtc;

        Status = next;
        Touch(nowUtc);
        return from;
    }

    public void Reassign(
        string assigneeId,
        string assigneeName,
        DateTime? dueAtUtc,
        DateTime nowUtc)
    {
        if (IsTerminal)
            throw new InvalidOperationException($"A {Status} task cannot be reassigned.");

        if (string.IsNullOrWhiteSpace(OriginalAssigneeId))
        {
            OriginalAssigneeId = AssigneeId;
            OriginalAssigneeName = AssigneeName;
        }

        AssigneeId = assigneeId.Trim();
        AssigneeName = assigneeName;
        if (dueAtUtc.HasValue)
            DueAtUtc = dueAtUtc.Value;
        Touch(nowUtc);
    }

    /// <summary>
    /// Stamps who gets execution credit at close. Defaults to the original assignee so a
    /// reassignment does not hand the credit to whoever happened to close the task.
    /// </summary>
    public void ApplyExecutionCredit(string? requestedId, string? requestedName, DateTime nowUtc)
    {
        var creditId = requestedId?.Trim() ?? "";
        var creditName = requestedName?.Trim() ?? "";

        if (creditId.Length == 0)
        {
            if (!string.IsNullOrWhiteSpace(OriginalAssigneeId))
            {
                creditId = OriginalAssigneeId.Trim();
                creditName = OriginalAssigneeName?.Trim() ?? "";
            }
            else
            {
                creditId = AssigneeId;
                creditName = AssigneeName;
            }
        }

        CreditAssigneeId = creditId;
        CreditAssigneeName = creditName;
        Touch(nowUtc);
    }

    /// <summary>True when the assignee changed after creation, so credit is worth logging.</summary>
    public bool WasReassigned =>
        !string.IsNullOrWhiteSpace(OriginalAssigneeId)
        && !string.Equals(OriginalAssigneeId, AssigneeId, StringComparison.Ordinal);

    public void ChangePriority(OperationsTaskPriority priority, DateTime nowUtc)
    {
        Priority = priority;
        Touch(nowUtc);
    }

    public void Reschedule(DateTime dueAtUtc, DateTime nowUtc)
    {
        DueAtUtc = dueAtUtc;
        Touch(nowUtc);
    }

    public void Retitle(string title, DateTime nowUtc)
    {
        Title = title;
        Touch(nowUtc);
    }

    public void Describe(string? description, DateTime nowUtc)
    {
        Description = description;
        Touch(nowUtc);
    }

    public void RecordCourtVisitResult(string? resultJson, DateTime nowUtc)
    {
        if (!IsCourtVisit)
        {
            throw new InvalidOperationException(
                "A court-visit result can only be recorded on a court-visit task.");
        }

        CourtVisitResultJson = resultJson;
        Touch(nowUtc);
    }

    public void ReplaceComments(string? commentsJson, DateTime nowUtc)
    {
        CommentsJson = commentsJson;
        Touch(nowUtc);
    }

    public void ReplaceReminders(string? remindersJson, DateTime nowUtc)
    {
        RemindersJson = remindersJson;
        Touch(nowUtc);
    }

    public void MarkPauseOverLimitReminded(DateTime nowUtc)
    {
        PauseOverLimitRemindedAtUtc = nowUtc;
        Touch(nowUtc);
    }

    private void Touch(DateTime nowUtc) => UpdatedAtUtc = nowUtc;
}

public class OperationsTaskSequence
{
    public Guid Id { get; set; }
    public int Year { get; set; }
    public int NextSeq { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
}
