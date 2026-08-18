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
