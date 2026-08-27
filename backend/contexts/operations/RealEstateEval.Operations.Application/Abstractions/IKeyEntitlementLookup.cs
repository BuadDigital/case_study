using RealEstateEval.Application.Contracts;
using RealEstateEval.Operations.Application.Contracts;

namespace RealEstateEval.Operations.Application.Abstractions;

/// <summary>
/// Court-envelope revenue entitlements keyed by property. EF on Operations;
/// HTTP from Case Study billing.
/// </summary>
public interface IKeyEntitlementLookup
{
    Task<IReadOnlyList<KeyEnvelopeEntitlementDto>> ListByPropertyIdsAsync(
        IReadOnlyList<Guid> propertyIds,
        CancellationToken cancellationToken = default);
}
