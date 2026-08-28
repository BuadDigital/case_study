using RealEstateEval.Domain;

namespace RealEstateEval.CaseStudy.Domain;

/// <summary>
/// A workflow task: either a case-study parent (one per property slot of a work order) or one
/// party child spawned from it. Kind never changes after creation; phase and status only move
/// through the transitions below so that a completed task cannot silently keep advancing.
/// </summary>
public class WorkflowTask
{
 /// <summary>For EF materialization and the factory methods.</summary>
    private WorkflowTask()
    {
    }

    public Guid Id { get; private set; }
    public WorkflowTaskKind Kind { get; private set; } = WorkflowTaskKind.CaseStudyProperty;
    public string PoNumber { get; private set; } = "";
    public Guid? PropertyId { get; private set; }
    public int PropertyOrdinal { get; private set; } = 1;
    public string Title { get; private set; } = "";
    public WorkflowTaskPhase Phase { get; private set; } = WorkflowTaskPhase.Enfath;
    public string AssigneeRole { get; private set; } = StaffRoleIds.CaseSpecialist;
    public string AssigneeName { get; private set; } = "أخصائي دراسة الحالة";
    public string? AssigneeId { get; private set; }
    public Guid? ParentTaskId { get; private set; }
    public WorkflowTaskStatus Status { get; private set; } = WorkflowTaskStatus.Open;
 /// <summary>JSON — TaskDistributionDraft from the shell.</summary>
    public string? DistributionJson { get; private set; }
    public string? ObstructionReason { get; private set; }
    public WorkflowTaskPhase? ObstructionPriorPhase { get; private set; }
    public string? AssignmentType { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }
    public DateTime UpdatedAtUtc { get; private set; }

    public bool IsCaseStudyParent => Kind == WorkflowTaskKind.CaseStudyProperty;

    public bool IsTerminal => Status.IsTerminal();

 /// <summary>
 /// General factory. Production paths should prefer <see cref="CreateCaseStudySlot"/> or
 /// <see cref="CreatePartyChild"/>; this overload exists for seeding, imports and fixtures
 /// that need to start from an arbitrary but still valid state.
 /// </summary>
    public static WorkflowTask Create(
        WorkflowTaskKind kind,
        string poNumber,
        DateTime nowUtc,
        string title = "",
        WorkflowTaskPhase phase = WorkflowTaskPhase.Enfath,
        WorkflowTaskStatus status = WorkflowTaskStatus.Open,
        string assigneeRole = StaffRoleIds.CaseSpecialist,
        string assigneeName = "أخصائي دراسة الحالة",
        Guid? id = null,
        Guid? propertyId = null,
        int propertyOrdinal = 1,
        string? assigneeId = null,
        Guid? parentTaskId = null,
        string? distributionJson = null,
        string? assignmentType = null,
        DateTime? updatedAtUtc = null) => new()
        {
            Id = id ?? Guid.NewGuid(),
            Kind = kind,
            PoNumber = poNumber,
            PropertyId = propertyId,
            PropertyOrdinal = propertyOrdinal,
            Title = title,
            Phase = phase,
            AssigneeRole = assigneeRole,
            AssigneeName = assigneeName,
            AssigneeId = NullIfBlank(assigneeId),
            ParentTaskId = parentTaskId,
            Status = status,
            DistributionJson = distributionJson,
            AssignmentType = assignmentType,
            CreatedAtUtc = nowUtc,
            UpdatedAtUtc = updatedAtUtc ?? nowUtc,
        };

 /// <summary>An unlinked property slot on a work order, waiting for Enfath primary data.</summary>
    public static WorkflowTask CreateCaseStudySlot(
        string poNumber,
        int propertyOrdinal,
        string title,
        string distributionJson,
        string? assignmentType,
        DateTime nowUtc) =>
        Create(
            WorkflowTaskKind.CaseStudyProperty,
            poNumber,
            nowUtc,
            title: title,
            phase: WorkflowTaskPhase.Enfath,
            propertyOrdinal: propertyOrdinal,
            distributionJson: distributionJson,
            assignmentType: assignmentType);

 /// <summary>
 /// A party task spawned by confirming distribution. Children carry no phase of their own,
 /// so they start (and stay) in <see cref="WorkflowTaskPhase.Done"/>.
 /// </summary>
    public static WorkflowTask CreatePartyChild(
        WorkflowTask parent,
        WorkflowTaskKind kind,
        string assigneeRole,
        string assigneeName,
        string? assigneeId,
        string title,
        DateTime nowUtc)
    {
        if (kind == WorkflowTaskKind.CaseStudyProperty)
        {
            throw new InvalidOperationException(
                "A case-study parent cannot be spawned as a party child.");
        }

        return Create(
            kind,
            parent.PoNumber,
            nowUtc,
            title: title,
            phase: WorkflowTaskPhase.Done,
            assigneeRole: assigneeRole,
            assigneeName: assigneeName,
            propertyId: parent.PropertyId,
            propertyOrdinal: parent.PropertyOrdinal,
            assigneeId: assigneeId,
            parentTaskId: parent.Id);
    }

    public void Retitle(string title, DateTime nowUtc)
    {
        Title = title;
        Touch(nowUtc);
    }

    public void Assign(string? assigneeId, string assigneeName, string? assigneeRole, DateTime nowUtc)
    {
        AssigneeId = NullIfBlank(assigneeId);
        AssigneeName = assigneeName;
        if (!string.IsNullOrWhiteSpace(assigneeRole))
            AssigneeRole = assigneeRole.Trim();
        Touch(nowUtc);
    }

    public void SetAssignmentType(string? assignmentType, DateTime nowUtc)
    {
        AssignmentType = assignmentType;
        Touch(nowUtc);
    }

    public void SetDistribution(string? distributionJson, DateTime nowUtc)
    {
        DistributionJson = distributionJson;
        Touch(nowUtc);
    }

 /// <summary>Links the Enfath property and moves the slot on to its next phase.</summary>
    public void AdvanceAfterEnfath(
        Guid? propertyId,
        WorkflowTaskPhase phase,
        string title,
        DateTime nowUtc)
    {
        RequireOpenForPhaseChange();
        PropertyId = propertyId;
        Phase = phase;
        Title = title;
        Touch(nowUtc);
    }

 /// <summary>Bourse data completed — the slot is ready for party distribution.</summary>
    public void AdvanceAfterBourse(string title, DateTime nowUtc)
    {
        RequireOpenForPhaseChange();
        Phase = WorkflowTaskPhase.Distribution;
        Title = title;
        Touch(nowUtc);
    }

 /// <summary>Distribution confirmed — the parent enters case study while its children run.</summary>
    public void ConfirmDistribution(string title, string distributionJson, DateTime nowUtc)
    {
        if (Phase != WorkflowTaskPhase.Distribution)
        {
            throw new InvalidOperationException(
                $"Distribution can only be confirmed from the distribution phase (was {Phase}).");
        }

        Phase = WorkflowTaskPhase.CaseStudy;
        Status = WorkflowTaskStatus.Open;
        Title = title;
        DistributionJson = distributionJson;
        Touch(nowUtc);
    }

 /// <summary>
 /// Sends a slot back one phase. Only <c>distribution → bourse</c> and
 /// <c>bourse → enfath</c> are reachable: once case study starts there is party work to undo.
 /// </summary>
    public bool CanRevertTo(WorkflowTaskPhase target) =>
        IsCaseStudyParent
        && !IsTerminal
        && Phase is not (WorkflowTaskPhase.Done or WorkflowTaskPhase.CaseStudy)
        && ((Phase == WorkflowTaskPhase.Distribution && target == WorkflowTaskPhase.Bourse)
            || (Phase == WorkflowTaskPhase.Bourse && target == WorkflowTaskPhase.Enfath));

    public void RevertToPhase(WorkflowTaskPhase target, string title, DateTime nowUtc)
    {
        if (!CanRevertTo(target))
            throw new InvalidOperationException($"Cannot revert from {Phase} to {target}.");

        Phase = target;
        Status = WorkflowTaskStatus.Open;
        Title = title;
        Touch(nowUtc);
    }

 /// <summary>
 /// Unlinks the property and returns the task to an empty Enfath slot — used when a property
 /// is removed from the work order.
 /// </summary>
    public void ResetToEmptySlot(string title, string distributionJson, DateTime nowUtc)
    {
        PropertyId = null;
        Phase = WorkflowTaskPhase.Enfath;
        Status = WorkflowTaskStatus.Open;
        Title = title;
        DistributionJson = distributionJson;
        ObstructionReason = null;
        ObstructionPriorPhase = null;
        Touch(nowUtc);
    }

    public void LinkProperty(Guid propertyId, WorkflowTaskPhase phase, string title, DateTime nowUtc)
    {
        PropertyId = propertyId;
        Phase = phase;
        Title = title;
        Touch(nowUtc);
    }

 /// <summary>Moves a linked slot to the phase its property data now warrants.</summary>
    public void MoveToPhase(WorkflowTaskPhase phase, string title, DateTime nowUtc)
    {
        RequireOpenForPhaseChange();
        Phase = phase;
        Title = title;
        Touch(nowUtc);
    }

    public void Complete(DateTime nowUtc)
    {
        if (IsTerminal)
            throw new InvalidOperationException($"A {Status} task cannot be completed.");

        Status = WorkflowTaskStatus.Completed;
        Touch(nowUtc);
    }

    public void Cancel(DateTime nowUtc)
    {
        if (IsTerminal)
            throw new InvalidOperationException($"A {Status} task cannot be cancelled.");

        Status = WorkflowTaskStatus.Cancelled;
        Touch(nowUtc);
    }

    public bool CanReopen => Status == WorkflowTaskStatus.Completed;

 /// <summary>
 /// Section supervisor and above may reopen a completed task. A case-study parent goes back
 /// to the case-study phase — that is where the reopened work is done.
 /// </summary>
    public void Reopen(DateTime nowUtc)
    {
        if (!CanReopen)
            throw new InvalidOperationException("Only a completed task can be reopened.");

        Status = WorkflowTaskStatus.Open;
        if (IsCaseStudyParent)
            Phase = WorkflowTaskPhase.CaseStudy;
        Touch(nowUtc);
    }

 /// <summary>Blocks the task on an obstruction (تعذر), remembering the phase to come back to.</summary>
    public void Block(string reason, DateTime nowUtc)
    {
        if (IsTerminal)
            throw new InvalidOperationException($"A {Status} task cannot be blocked.");

        if (Phase != WorkflowTaskPhase.Obstruction)
            ObstructionPriorPhase = Phase;
        Phase = WorkflowTaskPhase.Obstruction;
        Status = WorkflowTaskStatus.Blocked;
        ObstructionReason = reason;
        Touch(nowUtc);
    }

 /// <summary>
 /// Clears the obstruction and returns to the remembered phase. <paramref name="fallbackPhase"/>
 /// covers rows blocked before the prior phase was recorded.
 /// </summary>
    public void Unblock(DateTime nowUtc, WorkflowTaskPhase fallbackPhase = WorkflowTaskPhase.Enfath)
    {
        Phase = ObstructionPriorPhase ?? fallbackPhase;
        Status = WorkflowTaskStatus.Open;
        ObstructionReason = null;
        ObstructionPriorPhase = null;
        Touch(nowUtc);
    }

 /// <summary>
 /// The shell's generic PATCH. It is deliberately lenient — the endpoint has always accepted
 /// any subset of fields — but it is the only unguarded door into the aggregate, and unknown
 /// phase/status values are now dropped instead of being written through.
 /// </summary>
    public void ApplyShellPatch(
        WorkflowTaskPhase? phase,
        WorkflowTaskStatus? status,
        string? title,
        string? assigneeRole,
        string? assigneeName,
        string? assigneeId,
        bool assigneeIdProvided,
        Guid? propertyId,
        bool propertyIdProvided,
        string? obstructionReason,
        bool obstructionReasonProvided,
        WorkflowTaskPhase? obstructionPriorPhase,
        bool obstructionPriorPhaseProvided,
        string? distributionJson,
        DateTime nowUtc)
    {
        if (phase.HasValue) Phase = phase.Value;
        if (status.HasValue) Status = status.Value;
        if (title is not null) Title = title;
        if (assigneeRole is not null) AssigneeRole = assigneeRole;
        if (assigneeName is not null) AssigneeName = assigneeName;
        if (assigneeIdProvided) AssigneeId = assigneeId;
        if (propertyIdProvided) PropertyId = propertyId;
        if (obstructionReasonProvided) ObstructionReason = obstructionReason;
        if (obstructionPriorPhaseProvided) ObstructionPriorPhase = obstructionPriorPhase;
        if (distributionJson is not null) DistributionJson = distributionJson;
        Touch(nowUtc);
    }

    private void RequireOpenForPhaseChange()
    {
        if (IsTerminal)
            throw new InvalidOperationException($"A {Status} task cannot change phase.");
    }

    private void Touch(DateTime nowUtc) => UpdatedAtUtc = nowUtc;

    private static string? NullIfBlank(string? value) => Texts.NullIfBlank(value);
}
