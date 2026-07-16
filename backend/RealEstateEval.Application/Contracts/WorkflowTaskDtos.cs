namespace RealEstateEval.Application.Contracts;

public class TaskDistributionDraftDto
{
    public bool GovernmentAuditor { get; set; }
    public string GovernmentAuditorId { get; set; } = "";
    public bool ValuationDepartment { get; set; }
    public string OperationsCoordinatorId { get; set; } = "";
    public string InspectorId { get; set; } = "";
    public string ValuatorId { get; set; } = "";
    public bool EngineeringOffice { get; set; }
    public string EngineeringOfficeId { get; set; } = "";
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
