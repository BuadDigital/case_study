using RealEstateEval.Attachments.Application.Abstractions;
using RealEstateEval.Attachments.Domain;
using RealEstateEval.Valuation.Application.Abstractions;

namespace RealEstateEval.Valuation.Infrastructure.Services;

/// <summary>
/// Bridges the Valuation port to the Attachments-owned lookup and applies the Attachments print
/// routing: scope-routed files when the property has any, otherwise its images. Capped so a
/// property with hundreds of files cannot blow up the report payload.
/// </summary>
public sealed class ValuationPrintableAttachmentLookup(IAttachmentLookup attachments)
    : IValuationPrintableAttachmentLookup
{
    private const int MaxPrintable = 40;

    public async Task<IReadOnlyList<ReportAttachmentRef>> ListPrintableAsync(
        string propertyId,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(propertyId)) return [];

        var all = await attachments.ListForPropertyAsync(propertyId, actor: null, cancellationToken);

        var routed = all
            .Where(a => AttachmentPrintRules.TypeKeyFromScope(a.Scope) is not null)
            .OrderBy(a => a.CreatedAtUtc)
            .Take(MaxPrintable)
            .Select(a => new ReportAttachmentRef(a.Id, a.ContentType))
            .ToList();
        if (routed.Count > 0) return routed;

        return all
            .Where(a => a.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
            .OrderBy(a => a.CreatedAtUtc)
            .Take(MaxPrintable)
            .Select(a => new ReportAttachmentRef(a.Id, a.ContentType))
            .ToList();
    }
}
