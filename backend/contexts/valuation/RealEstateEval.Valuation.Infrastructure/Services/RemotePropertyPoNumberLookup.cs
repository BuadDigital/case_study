using RealEstateEval.Application.Abstractions;

namespace RealEstateEval.Valuation.Infrastructure.Services;

/// <summary>
/// PO-number resolution over the Case Study HTTP API for hosts without
/// <c>CaseStudyDbContext</c> (A9). Uses the valuation property context so soft-removed
/// properties still resolve, matching <see cref="CaseStudyPropertyPoNumberLookup"/>.
/// </summary>
public sealed class RemotePropertyPoNumberLookup(ICaseStudyLookup caseStudy) : IPropertyPoNumberLookup
{
    public async Task<string> ResolveForPropertyAsync(
        string propertyId,
        CancellationToken cancellationToken = default)
    {
        if (!Guid.TryParse(propertyId, out var id))
            return "";

        var context = await caseStudy.GetValuationPropertyContextAsync(id, cancellationToken);
        return context?.PoNumber ?? "";
    }
}
