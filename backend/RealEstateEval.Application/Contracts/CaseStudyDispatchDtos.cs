using RealEstateEval.Domain;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.Application.Contracts;

public sealed class CaseStudyWorkOrderSummaryDto
{
    public Guid Id { get; set; }
    public string PoNumber { get; set; } = "";
    public int PropertyCount { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime ReceivedFromEnfathAtUtc { get; set; }
}

public sealed class CaseStudyWorkflowTaskKindDto
{
    public Guid Id { get; set; }
    public string Kind { get; set; } = "";
}

public sealed class CaseStudyPropertySnapshotDto
{
    public Guid Id { get; set; }
    public string PoNumber { get; set; } = "";
    public string DeedNumber { get; set; } = "";
    public string RequestNumber { get; set; } = "";
    public string OwnerName { get; set; } = "";
    public string City { get; set; } = "";
    public string District { get; set; } = "";
    public string Court { get; set; } = "";
    public string Circuit { get; set; } = "";
    public string PropertyType { get; set; } = "";
    public string? DeedStatus { get; set; }
    public bool IsRemoved { get; set; }
    public Guid WorkOrderId { get; set; }
    public string? Area { get; set; }
    public DateTime? BourseCompletedAtUtc { get; set; }
}

public sealed class CaseStudyWorkflowTaskSnapshotDto
{
    public Guid Id { get; set; }
    public string Kind { get; set; } = "";
    public string Status { get; set; } = "";
    public string PoNumber { get; set; } = "";
    public Guid? PropertyId { get; set; }
    public int PropertyOrdinal { get; set; } = 1;
    public string? AssigneeId { get; set; }
    public DateTime UpdatedAtUtc { get; set; }

    public WorkflowTask ToWorkflowTask()
    {
        var kind = WorkflowTaskKindValues.TryParse(Kind, out var parsedKind)
            ? parsedKind
            : Enum.TryParse(Kind, true, out parsedKind)
                ? parsedKind
                : WorkflowTaskKind.CaseStudyProperty;
        var status = WorkflowTaskStatusValues.TryParse(Status, out var parsedStatus)
            ? parsedStatus
            : Enum.TryParse(Status, true, out parsedStatus)
                ? parsedStatus
                : WorkflowTaskStatus.Open;
        return WorkflowTask.Create(
            kind,
            PoNumber,
            UpdatedAtUtc,
            status: status,
            id: Id,
            propertyId: PropertyId,
            propertyOrdinal: PropertyOrdinal,
            assigneeId: AssigneeId,
            updatedAtUtc: UpdatedAtUtc);
    }
}

public sealed class CaseStudyPartyTaskSubmissionSnapshotDto
{
    public Guid WorkflowTaskId { get; set; }
    public string Status { get; set; } = "";
    public string PayloadJson { get; set; } = "{}";
    public DateTime? SubmittedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }

    public PartyTaskSubmission ToSubmission() => new()
    {
        WorkflowTaskId = WorkflowTaskId,
        Status = Status,
        PayloadJson = PayloadJson,
        SubmittedAtUtc = SubmittedAtUtc,
        UpdatedAtUtc = UpdatedAtUtc,
    };
}

public sealed class CaseStudyFieldInspectionWorkspaceSnapshotDto
{
    public Guid WorkflowTaskId { get; set; }
    public string Status { get; set; } = "";
    public DateTime? SubmittedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }

    public FieldInspectionWorkspace ToWorkspace() => new()
    {
        WorkflowTaskId = WorkflowTaskId,
        Status = Status,
        SubmittedAtUtc = SubmittedAtUtc,
        UpdatedAtUtc = UpdatedAtUtc,
    };
}

public sealed class CaseStudyWorkOrderBillingSnapshotDto
{
    public Guid Id { get; set; }
    public string PoNumber { get; set; } = "";
    public DateTime CreatedAtUtc { get; set; }
    public DateTime ReceivedFromEnfathAtUtc { get; set; }
    public IReadOnlyList<CaseStudyPropertySnapshotDto> Properties { get; set; } = [];
}

public sealed class CaseStudyDocumentReferenceDto
{
    public string Reference { get; set; } = "";
}

public sealed class AllocateCaseStudyDocumentReferenceRequest
{
    public string Dept { get; set; } = "";
    public string Type { get; set; } = "";
    public string DateKey { get; set; } = "";
}

public sealed class BackfillCaseStudyPropertyAreaRequest
{
    public decimal AreaM2 { get; set; }
}

public sealed class CaseStudyWorkOrderIdDto
{
    public Guid? Id { get; set; }
}

public sealed class CaseStudyWorkOrderReceivedAtDto
{
    public string PoNumber { get; set; } = "";
    public DateTime? ReceivedFromEnfathAtUtc { get; set; }
}

public sealed class CaseStudyAssigneeDto
{
    public string? AssigneeId { get; set; }
}

/// <summary>Failures→Case Study: set a property's deed status by the failure's identifiers.</summary>
public sealed class SetCaseStudyDeedStatusRequest
{
    public string PoNumber { get; set; } = "";
    /// <summary>Failure PropertyId — a Guid string OR a deed number.</summary>
    public string PropertyId { get; set; } = "";
    public string DeedNumber { get; set; } = "";
    public string DeedStatus { get; set; } = "";
}

/// <summary>Failures→Case Study: escalate the case-study task into the obstruction phase.</summary>
public sealed class EscalateCaseStudyObstructionRequest
{
    public string PoNumber { get; set; } = "";
    /// <summary>Failure PropertyId — a Guid string OR a deed number.</summary>
    public string PropertyId { get; set; } = "";
    public string Reason { get; set; } = "";
}

/// <summary>Failures→Case Study: resume the case-study task from obstruction (resets bourse when resuming there).</summary>
public sealed class ResolveCaseStudyObstructionRequest
{
    public string PoNumber { get; set; } = "";
    /// <summary>Failure PropertyId — a Guid string OR a deed number.</summary>
    public string PropertyId { get; set; } = "";
}

/// <summary>Failures→Case Study: block every open task of the property after a failure is approved.</summary>
public sealed class BlockCaseStudyTasksForFailureRequest
{
    public string PoNumber { get; set; } = "";
    /// <summary>Failure PropertyId — a Guid string OR a deed number.</summary>
    public string PropertyId { get; set; } = "";
    public string Reason { get; set; } = "";
}

/// <summary>Failures→Case Study: block/unblock the case-study task for an access hold.</summary>
public sealed class CaseStudyHoldTaskRequest
{
    public string PoNumber { get; set; } = "";
    public Guid PropertyId { get; set; }
    public string Reason { get; set; } = "";
}

/// <summary>The task a hold command touched, so the caller can notify its specialist.</summary>
public sealed class CaseStudyHoldTaskResultDto
{
    public Guid TaskId { get; set; }
    public string? AssigneeId { get; set; }
}

public sealed class CaseStudyGovReviewKeyStatusDto
{
    public Guid PropertyId { get; set; }
    public string PoNumber { get; set; } = "";
    public int PropertyOrdinal { get; set; }
    public string AssigneeName { get; set; } = "";
    public string? KeysStatus { get; set; }
    public string City { get; set; } = "";
    public string PropertyType { get; set; } = "";
    public string DeedNumber { get; set; } = "";
}
