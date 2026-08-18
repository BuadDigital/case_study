namespace RealEstateEval.Application.Contracts;

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
