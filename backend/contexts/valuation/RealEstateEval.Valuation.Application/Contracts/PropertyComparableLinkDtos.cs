namespace RealEstateEval.Valuation.Application.Contracts;

public class PropertyComparableLinkItemDto
{
    public Guid LinkId { get; init; }
    public Guid PropertyId { get; init; }
    public Guid ComparablePropertyId { get; init; }
    public string? Description { get; init; }
    public string? LinkedByUserId { get; init; }
    public string LinkedAtUtc { get; init; } = "";
    public ComparablePropertyDto Comparable { get; init; } = null!;
}

public class PropertyComparableLinkListDto
{
    public Guid PropertyId { get; init; }
    public int LinkedCount { get; init; }
    public IReadOnlyList<PropertyComparableLinkItemDto> Items { get; init; } = [];
}
