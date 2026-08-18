using System.ComponentModel.DataAnnotations;
using RealEstateEval.Domain;

namespace RealEstateEval.Application.Contracts;

// Field-dictionary DTOs moved to RealEstateEval.Platform.Application (A8).

// Failure-types catalog DTOs moved to RealEstateEval.Failures.Application (A8).
// Evaluator-recall DTOs moved to RealEstateEval.Valuation.Application (A8).

public class SurveyOfficeDto
{
    public Guid Id { get; init; }
    public required string Name { get; init; }
    public int Active { get; init; }
    public int DoneMonth { get; init; }
    public required string AvgDays { get; init; }
    public required string Contract { get; init; }
    public bool StatusBusy { get; init; }
    public int SortOrder { get; init; }
}

public class ValuationRequestDto
{
    public Guid Id { get; init; }
    public required string DisplayId { get; init; }
    public required string PropId { get; init; }
    public required string Area { get; init; }
    public required string Type { get; init; }
    public required string Appraiser { get; init; }
    public required string Status { get; init; }
    public required string Date { get; init; }
}

public class SaveValuationRequestRequest
{
    [MaxLength(64)]
    public string? DisplayId { get; init; }
    [Required, MaxLength(128)]
    public string PropId { get; init; } = "";
    [Required, MaxLength(128)]
    public string Area { get; init; } = "";
    [Required, MaxLength(128)]
    public string Type { get; init; } = "";
    [Required, MaxLength(256)]
    public string Appraiser { get; init; } = "";
    [Required, MaxLength(32)]
    public string Status { get; init; } = ValuationRequestStatuses.Progress;
    [MaxLength(32)]
    public string Date { get; init; } = "";
}

public class ValuationImpedimentRequest
{
    [Required, MaxLength(2000)]
    public string Reason { get; init; } = "";
}

public class PropertyKeyRecordDto
{
    public Guid Id { get; init; }
    public required string IdProp { get; init; }
    public required string Po { get; init; }
    public required string Area { get; init; }
    public required string Type { get; init; }
    public bool Key { get; init; }
    public required string Specialist { get; init; }
    public required string Status { get; init; }
    public string DeedStatus { get; init; } = "";
}

public class UpdatePropertyKeyRequest
{
    public bool? Key { get; init; }
    [MaxLength(32)]
    public string? Status { get; init; }
}

// Attachment DTOs moved to RealEstateEval.Attachments.Application (A8).

public sealed class UserLabelDto
{
    public required string Id { get; init; }
    public required string DisplayName { get; init; }
}

public sealed class IdentityCompensationProfileDto
{
    public required string AssigneeId { get; init; }
    public required string UserId { get; init; }
    public bool HasCompensation { get; init; }
    public ContractType? ContractType { get; init; }
    public ProcProviderKind? ProviderKind { get; init; }
    public string? EmploymentType { get; init; }
}

public sealed class IdentityUserIdDto
{
    public string? UserId { get; init; }
}

public sealed class IdentityUserIdsDto
{
    public IReadOnlyList<string> UserIds { get; init; } = [];
}

public sealed class WorkflowAssigneeIdsDto
{
    public IReadOnlyList<string> AssigneeIds { get; init; } = [];
}


public class SuspendedTransactionDto
{
    public Guid Id { get; init; }
    public required string PoNumber { get; init; }
    public required string PropertyId { get; init; }
    public required string FailureId { get; init; }
    public required string DeedNumber { get; init; }
    public required string Title { get; init; }
    public required string InternalNote { get; init; }
    public required string RaisedByRole { get; init; }
    public required string Specialist { get; init; }
    public string SupervisorNote { get; init; } = "";
    public DateTime SuspendedAt { get; init; }
    public string SuspendedBy { get; init; } = "";
}

public class DelegationLetterPropertyDto
{
    public required string PropertyId { get; init; }
    public required string WorkOrder { get; init; }
    public required string DeedNo { get; init; }
    public required string Owner { get; init; }
    public required string RequestNo { get; init; }
}

public class DelegationLetterAgentDto
{
    public string Name { get; init; } = "";
    public string Nationality { get; init; } = "";
    public string NationalId { get; init; } = "";
    public string Mobile { get; init; } = "";
}

public class PoIntakeDraftDto
{
    public int Step { get; init; }
    public string PoNumber { get; init; } = "";
    public string AssignmentType { get; init; } = "";
    public string PromulgationDate { get; init; } = "";
    public string AssignmentSpecialist { get; init; } = "";
    public string AssignmentSpecialistEmail { get; init; } = "";
    public int ExpectedPropertyCount { get; init; } = 1;
    public string PropertiesRegion { get; init; } = "";
    public string WorkOrderDescription { get; init; } = "";
    public DateTime UpdatedAtUtc { get; init; }
}