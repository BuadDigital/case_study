namespace RealEstateEval.Application.Abstractions;

// IPropertyKeyGateResolver moved to RealEstateEval.Operations.Application (A8).
// IPropertyAccessHoldService stays: the case-study host registers it too.

public interface IPropertyAccessHoldService
{
    Task EnsureEvictionHoldAsync(
        Guid propertyId,
        string actorName,
        CancellationToken cancellationToken = default);

    Task ResolveEvictionHoldAsync(
        Guid propertyId,
        string actorName,
        CancellationToken cancellationToken = default);

    Task EnsureKeyUnmatchedFailureAsync(
        Guid propertyId,
        string deedNumber,
        string actorName,
        CancellationToken cancellationToken = default);
}
