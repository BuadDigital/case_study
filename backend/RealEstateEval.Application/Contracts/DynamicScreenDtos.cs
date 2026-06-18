using System.ComponentModel.DataAnnotations;

namespace RealEstateEval.Application.Contracts;

public class DynamicScreenFieldDto
{
    public required string Id { get; init; }
    public required string Ref { get; init; }
    public required string Name { get; init; }
    public required string Type { get; init; }
    public IReadOnlyList<string> Options { get; init; } = [];
    public string? Placeholder { get; init; }
}

public class DynamicScreenLayoutCellDto
{
    public int X { get; init; }
    public int Y { get; init; }
    public int W { get; init; } = 12;
    public int H { get; init; } = 1;
}

public class DynamicScreenFieldBindingDto
{
    public required string FieldId { get; init; }
    public required string Mode { get; init; }
    public bool Required { get; init; }
    public required DynamicScreenLayoutCellDto Layout { get; init; }
}

public class DynamicScreenDefinitionDto
{
    public required string Code { get; init; }
    public required string OwnerRole { get; init; }
    public required string Status { get; init; }
    public IReadOnlyList<DynamicScreenFieldDto> Fields { get; init; } = [];
    public IReadOnlyList<DynamicScreenFieldBindingDto> Bindings { get; init; } = [];
}

public class SaveDynamicScreenDefinitionRequest
{
    [MaxLength(32)]
    public string? Code { get; init; }

    public IReadOnlyList<DynamicScreenFieldDto> Fields { get; init; } = [];
    public IReadOnlyList<DynamicScreenFieldBindingDto> Bindings { get; init; } = [];
}

public class DynamicScreenSubmissionDto
{
    public Guid Id { get; init; }
    public Guid ScreenId { get; init; }
    public required string UserId { get; init; }
    public IReadOnlyDictionary<string, object?> Answers { get; init; }
        = new Dictionary<string, object?>();
    public bool IsDraft { get; init; }
    public DateTime UpdatedAtUtc { get; init; }
    public DateTime? SubmittedAtUtc { get; init; }
}

public class SaveDynamicScreenSubmissionRequest
{
    public IReadOnlyDictionary<string, object?> Answers { get; init; }
        = new Dictionary<string, object?>();
    public bool IsDraft { get; init; } = true;
}
