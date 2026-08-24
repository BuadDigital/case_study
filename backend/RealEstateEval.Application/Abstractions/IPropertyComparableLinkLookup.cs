namespace RealEstateEval.Application.Abstractions;

/// <summary>Case-study submit gate — bank comps linked to the subject property.</summary>
public interface IPropertyComparableLinkLookup
{
    Task<int> CountLinkedAsync(Guid propertyId, CancellationToken cancellationToken = default);
}
