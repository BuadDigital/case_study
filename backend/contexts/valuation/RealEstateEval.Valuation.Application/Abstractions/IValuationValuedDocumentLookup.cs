namespace RealEstateEval.Valuation.Application.Abstractions;

/// <summary>
/// The «مستندات ذات قيمة» of one property (both the documents-tab key «PO:propertyId» and the
/// party key «propertyId»), read as a trusted internal caller — the valuation endpoints apply
/// their own role check.
/// </summary>
public interface IValuationValuedDocumentLookup
{
    Task<IReadOnlyList<Contracts.ValuedDocumentLookupDto>> ListAsync(
        Guid propertyId,
        CancellationToken cancellationToken);
}
