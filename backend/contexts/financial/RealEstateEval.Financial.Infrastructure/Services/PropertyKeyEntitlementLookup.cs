using RealEstateEval.Financial.Application.Abstractions;
using RealEstateEval.Operations.Application.Abstractions;

namespace RealEstateEval.Financial.Infrastructure.Services;

/// <summary>
/// Bridges the Financial port to the Operations-owned key-entitlement lookup (EF on Operations,
/// HTTP everywhere else). Keeps <c>Financial.Application</c> free of Operations contracts.
/// </summary>
public sealed class PropertyKeyEntitlementLookup : IPropertyKeyEntitlementLookup
{
    private readonly IKeyEntitlementLookup _inner;

    public PropertyKeyEntitlementLookup(IKeyEntitlementLookup inner) => _inner = inner;

    public async Task<IReadOnlyList<PropertyKeyEntitlement>> ListByPropertyIdsAsync(
        IReadOnlyList<Guid> propertyIds,
        CancellationToken cancellationToken = default)
    {
        var rows = await _inner.ListByPropertyIdsAsync(propertyIds, cancellationToken);
        return rows
            .Select(r => new PropertyKeyEntitlement(r.PropertyId, r.EnvelopeId, r.AttachmentIds))
            .ToList();
    }
}
