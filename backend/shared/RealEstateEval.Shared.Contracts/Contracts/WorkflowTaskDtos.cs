using System.ComponentModel.DataAnnotations;

namespace RealEstateEval.Application.Contracts;

public class TaskDistributionDraftDto
{
 /// <summary>Wire field only — always forced off (government work via operations tasks).</summary>
    public bool GovernmentAuditor { get; set; }
 /// <summary>Wire field only — always cleared on normalize.</summary>
    public string GovernmentAuditorId { get; set; } = "";
    public bool ValuationDepartment { get; set; }
    public string OperationsCoordinatorId { get; set; } = "";
    public string InspectorId { get; set; } = "";
    public string ValuatorId { get; set; } = "";
    public bool EngineeringOffice { get; set; }
    public string EngineeringOfficeId { get; set; } = "";
 /// <summary>Assign a normal case specialist (not section supervisor) as study owner.</summary>
    public bool CaseSpecialist { get; set; }
    public string CaseSpecialistId { get; set; } = "";
}

public class WorkflowTaskDto
{
    public string Id { get; set; } = "";
    public string Kind { get; set; } = "";
    public string PoNumber { get; set; } = "";
    public string? PropertyId { get; set; }
    public int PropertyOrdinal { get; set; }
    public string Title { get; set; } = "";
    public string Phase { get; set; } = "";
    public string AssigneeRole { get; set; } = "";
    public string AssigneeName { get; set; } = "";
    public string? AssigneeId { get; set; }
    public string? ParentTaskId { get; set; }
    public string Status { get; set; } = "";
    public TaskDistributionDraftDto? Distribution { get; set; }
    public string? ObstructionReason { get; set; }
    public string? ObstructionPriorPhase { get; set; }
    public string? AssignmentType { get; set; }
    public string CreatedAt { get; set; } = "";
    public string UpdatedAt { get; set; } = "";

 /// <summary>
 /// Engineering-survey / property-appraisal: sibling field-inspection workflow task is completed.
 /// Populated on list so EO unlock works without seeing the inspection task row.
 /// </summary>
    public bool? FieldInspectionCompleted { get; set; }

 /// <summary>
 /// Property-appraisal: sibling field-inspection package is specialist-accepted.
 /// Appraiser starts valuation only after this stamp — completed-but-unaccepted is monitor-only.
 /// </summary>
    public bool? FieldInspectionAccepted { get; set; }

 /// <summary>
 /// Engineering-survey / property-appraisal: id of the completed sibling field-inspection task.
 /// Populated on list so parties can load inspection facts without seeing the sibling row.
 /// Prefer specialist-accepted inspection when several completed siblings exist.
 /// </summary>
    public string? FieldInspectionTaskId { get; set; }

 /// <summary>
 /// PO-record columns of the property this task hangs off, joined from
 /// <c>case_study.WorkOrderProperties</c> so the queue can page. Optional and additive: null when
 /// the task has no property (or the property row is gone), and every field the queue used to
 /// build from a separate PO-intake fetch. See docs/architecture/pagination-contract.md §2.
 /// </summary>
    public string? DeedNumber { get; set; }

 /// <inheritdoc cref="DeedNumber"/>
    public string? City { get; set; }

 /// <inheritdoc cref="DeedNumber"/>
    public string? District { get; set; }

 /// <inheritdoc cref="DeedNumber"/>
    public string? PropertyType { get; set; }

 /// <inheritdoc cref="DeedNumber"/>
    public string? Classification { get; set; }
}

public class PatchWorkflowTaskDistributionRequest
{
    public TaskDistributionDraftDto Distribution { get; set; } = new();
}

public class ConfirmTaskDistributionRequest
{
    public TaskDistributionDraftDto Distribution { get; set; } = new();
    public string DeedNumber { get; set; } = "";
 /// <summary>Optional display names keyed by child kind (government-review, field-inspection, …).</summary>
    public Dictionary<string, string>? AssigneeNames { get; set; }
}

public class ConfirmTaskDistributionResponseDto
{
    public WorkflowTaskDto? Parent { get; set; }
    public IReadOnlyList<WorkflowTaskDto> Children { get; set; } = [];
}

/// <summary>
/// Edits assignees on already-spawned party child tasks for a case-study parent
/// (post confirm-distribution). Does not add/remove party slots.
/// </summary>
public class RedistributePartiesRequest
{
    public TaskDistributionDraftDto Distribution { get; set; } = new();
 /// <summary>Optional display names keyed by child kind (government-review, field-inspection, …).</summary>
    public Dictionary<string, string>? AssigneeNames { get; set; }
 /// <summary>Reason for reassignment of parties — Mandatory, recorded in Event Log.</summary>
    [MaxLength(500)]
    public string? Reason { get; set; }
}

public class AdvanceTaskAfterEnfathRequest
{
    public string PropertyId { get; set; } = "";
    public string IdentifierType { get; set; } = "";
    public bool BourseDataCompleted { get; set; }
    public string DeedNumber { get; set; } = "";
}

public class AdvanceTaskAfterBourseRequest
{
    public string DeedNumber { get; set; } = "";
}

public class RevertWorkflowTaskPhaseRequest
{
 /// <summary>Target phase: <c>enfath</c> or <c>bourse</c>.</summary>
    public string TargetPhase { get; set; } = "";
}

public class DeleteCaseStudySlotRequest
{
 /// <summary>Reason for deletion — Mandatory and kept with the property if any.</summary>
    [MaxLength(500)]
    public string Reason { get; set; } = "";
}

public class ReopenCompletedWorkflowTaskRequest
{
 /// <summary>Reason for reopening — Mandatory, recorded in Event Log.</summary>
    [MaxLength(500)]
    public string Reason { get; set; } = "";
}

public class PatchWorkflowTaskRequest
{
    public string? Phase { get; set; }
    public string? Status { get; set; }
    public string? Title { get; set; }
    public string? AssigneeRole { get; set; }
    public string? AssigneeName { get; set; }
    public string? AssigneeId { get; set; }
    public string? PropertyId { get; set; }
    public string? ObstructionReason { get; set; }
    public string? ObstructionPriorPhase { get; set; }
    public TaskDistributionDraftDto? Distribution { get; set; }
}
