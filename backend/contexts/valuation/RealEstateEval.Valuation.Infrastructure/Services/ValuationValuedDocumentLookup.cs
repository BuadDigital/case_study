using RealEstateEval.Application.Abstractions;
using RealEstateEval.Attachments.Application.Abstractions;
using RealEstateEval.Domain;
using RealEstateEval.Valuation.Application.Abstractions;
using RealEstateEval.Valuation.Application.Contracts;

namespace RealEstateEval.Valuation.Infrastructure.Services;

/// <summary>
/// Bridges the Valuation port to the Attachments lookup: the property's «مستندات ذات قيمة»
/// under both scope-key forms — «PO:propertyId» (documents tab) and «propertyId» (parties).
/// </summary>
public sealed class ValuationValuedDocumentLookup(
    IAttachmentLookup attachments,
    ICaseStudyLookup caseStudy) : IValuationValuedDocumentLookup
{
    public async Task<IReadOnlyList<ValuedDocumentLookupDto>> ListAsync(
        Guid propertyId,
        CancellationToken cancellationToken)
    {
        if (propertyId == Guid.Empty) return [];

        var id = propertyId.ToString("D");
        var needles = new List<string> { id };
        var context = await caseStudy.GetValuationPropertyContextAsync(propertyId, cancellationToken);
        if (!string.IsNullOrWhiteSpace(context?.PoNumber))
            needles.Add($"{context.PoNumber.Trim()}:{id}");

        var result = new List<ValuedDocumentLookupDto>();
        var seen = new HashSet<Guid>();
        foreach (var needle in needles)
        {
            foreach (var a in await attachments.ListForPropertyAsync(needle, actor: null, cancellationToken))
            {
                if (!PropertyDocumentTypes.IsValued(a.DocumentTypeKey) || !seen.Add(a.Id)) continue;
                result.Add(new ValuedDocumentLookupDto(
                    a.Id,
                    string.IsNullOrWhiteSpace(a.CustomDocumentLabel) ? "مستند ذو قيمة" : a.CustomDocumentLabel.Trim(),
                    a.FileName,
                    a.ContentType,
                    a.CreatedAtUtc,
                    string.IsNullOrWhiteSpace(a.ValueDocStatus) ? ValueDocumentStatuses.Pending : a.ValueDocStatus,
                    a.ValueDocReviewNote));
            }
        }

        return result.OrderBy(d => d.CreatedAtUtc).ToList();
    }
}
