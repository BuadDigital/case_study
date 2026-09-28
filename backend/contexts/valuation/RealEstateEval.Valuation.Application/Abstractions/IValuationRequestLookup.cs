using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Valuation.Application.Abstractions;

/// <summary>Untracked read of one valuation request, for use cases that only need to read it.</summary>
public interface IValuationRequestLookup
{
    Task<ValuationRequest?> GetAsync(Guid valuationRequestId, CancellationToken cancellationToken);
}

/// <summary>The two attachment fields the report payload places into photo/document slots.</summary>
public sealed record ReportAttachmentRef(Guid Id, string ContentType);

/// <summary>
/// Printable attachments of one property, already routed by the Attachments print rules: the
/// scope-routed set when there is one, otherwise the images. Attachments are owned by another
/// context, so Valuation states the one question it asks here.
/// </summary>
public interface IValuationPrintableAttachmentLookup
{
    Task<IReadOnlyList<ReportAttachmentRef>> ListPrintableAsync(
        string propertyId,
        CancellationToken cancellationToken);
}

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
