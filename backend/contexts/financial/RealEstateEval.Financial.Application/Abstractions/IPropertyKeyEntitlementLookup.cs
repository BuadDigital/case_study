namespace RealEstateEval.Financial.Application.Abstractions;

/// <summary>
/// One court-envelope revenue entitlement as Enfaz billing needs it: which envelope earned the
/// key fee on a property, and the attachments that evidence it.
/// </summary>
public sealed record PropertyKeyEntitlement(
    Guid PropertyId,
    Guid EnvelopeId,
    IReadOnlyList<string> AttachmentIds);

/// <summary>
/// Key entitlements per property, owned by Operations. Financial states its own narrow shape
/// here rather than referencing the Operations contracts, so the Application assemblies of the
/// two contexts stay independent; the Infrastructure adapter bridges to
/// <c>IKeyEntitlementLookup</c>.
/// </summary>
public interface IPropertyKeyEntitlementLookup
{
    Task<IReadOnlyList<PropertyKeyEntitlement>> ListByPropertyIdsAsync(
        IReadOnlyList<Guid> propertyIds,
        CancellationToken cancellationToken = default);
}
