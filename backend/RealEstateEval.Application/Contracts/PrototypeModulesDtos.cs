using System.ComponentModel.DataAnnotations;
using RealEstateEval.Domain;

namespace RealEstateEval.Application.Contracts;

public class FieldDictionaryStateDto
{
    public IReadOnlyList<FieldDictionaryFieldDto> Fields { get; init; } = [];
    public IReadOnlyList<string> Tags { get; init; } = [];
    public DateTime UpdatedAtUtc { get; init; }
}

public class FieldDictionaryFieldDto
{
    public required string Id { get; init; }
    public required string Ref { get; init; }
    public required string Key { get; init; }
    public required string Name { get; init; }
    public required string Type { get; init; }
    public IReadOnlyList<string> Tags { get; init; } = [];
    public string? Source { get; init; }
    public string? Parent { get; init; }
    public string? Child { get; init; }
    public bool Persisted { get; init; }
    public IReadOnlyList<FieldDictionaryAssignmentDto> Assignments { get; init; } = [];
}

public class FieldDictionaryAssignmentDto
{
    public required string Role { get; init; }
    public IReadOnlyList<string> Screens { get; init; } = [];
    public required string Mode { get; init; }
    public bool Required { get; init; }
    public bool Final { get; init; }
}

public class SaveFieldDictionaryStateRequest
{
    public IReadOnlyList<FieldDictionaryFieldDto> Fields { get; init; } = [];
    public IReadOnlyList<string> Tags { get; init; } = [];
}

public class FailureTypeCategoryDto
{
    public required string Id { get; init; }
    public required string Label { get; init; }
    public int Order { get; init; }
}

public class FailureProblemTypeDto
{
    public required string Id { get; init; }
    public required string CategoryId { get; init; }
    public required string Label { get; init; }
    public string? Description { get; init; }
    public int Order { get; init; }
}

public class FailureTypesCatalogDto
{
    public IReadOnlyList<FailureTypeCategoryDto> Categories { get; init; } = [];
    public IReadOnlyList<FailureProblemTypeDto> ProblemTypes { get; init; } = [];
    public DateTime UpdatedAtUtc { get; init; }
}

public class SaveFailureTypesCatalogRequest
{
    public IReadOnlyList<FailureTypeCategoryDto> Categories { get; init; } = [];
    public IReadOnlyList<FailureProblemTypeDto> ProblemTypes { get; init; } = [];
}

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

public class SaveSurveyOfficeRequest
{
    [Required, MaxLength(256)]
    public string Name { get; init; } = "";
    public int Active { get; init; }
    public int DoneMonth { get; init; }
    [MaxLength(64)]
    public string AvgDays { get; init; } = "";
    [MaxLength(128)]
    public string Contract { get; init; } = "";
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
    public string Status { get; init; } = "progress";
    [MaxLength(32)]
    public string Date { get; init; } = "";
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

public class FileAttachmentMetaDto
{
    public Guid Id { get; init; }
    public required string Scope { get; init; }
    public required string ScopeKey { get; init; }
    public required string FileName { get; init; }
    public required string ContentType { get; init; }
    public long SizeBytes { get; init; }
    public DateTime CreatedAtUtc { get; init; }
}

public class UploadAttachmentRequest
{
    [Required, MaxLength(64)]
    public string Scope { get; init; } = "";
    [Required, MaxLength(512)]
    public string ScopeKey { get; init; } = "";
    [Required, MaxLength(512)]
    public string FileName { get; init; } = "";
    [MaxLength(128)]
    public string ContentType { get; init; } = "application/octet-stream";
    [Required]
    public string ContentBase64 { get; init; } = "";
}

public class UpdateUserRequest
{
    [MaxLength(256)]
    public string? DisplayName { get; init; }
    [MaxLength(256)]
    public string? JobTitle { get; init; }
    public UserStatus? Status { get; init; }
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

public class InternalDelegationLetterDto
{
    public required string Id { get; init; }
    public required string PoNumber { get; init; }
    public required string City { get; init; }
    public required string Court { get; init; }
    public required string Circuit { get; init; }
    public IReadOnlyList<string> SelectedPropertyIds { get; init; } = [];
    public required string CreatedAt { get; init; }
}

public class SaveInternalDelegationLettersRequest
{
    [Required, MaxLength(64)]
    public string PoNumber { get; init; } = "";
    public IReadOnlyList<InternalDelegationLetterDto> Letters { get; init; } = [];
}

public class EvaluatorRecallDto
{
    public Guid Id { get; init; }
    public required string TaskId { get; init; }
    public required string PoNumber { get; init; }
    public required string PropertyId { get; init; }
    public required string Status { get; init; }
    public required string Reason { get; init; }
    public required string SpecialistNote { get; init; }
    public DateTime RequestedAtUtc { get; init; }
    public DateTime? ResolvedAtUtc { get; init; }
}

public class CreateEvaluatorRecallRequest
{
    [Required, MaxLength(64)]
    public string TaskId { get; init; } = "";
    [Required, MaxLength(64)]
    public string PoNumber { get; init; } = "";
    [Required, MaxLength(128)]
    public string PropertyId { get; init; } = "";
    [MaxLength(4000)]
    public string? Reason { get; init; }
}

public class RejectEvaluatorRecallRequest
{
    [MaxLength(4000)]
    public string? SpecialistNote { get; init; }
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
    public DateTime UpdatedAtUtc { get; init; }
}
