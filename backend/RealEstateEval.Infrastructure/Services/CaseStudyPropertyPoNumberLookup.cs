using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Infrastructure.Services;

/// <summary>
/// Phase-1 bridge for the one Case Study value the Valuation context still needs.
/// <para>
/// Read-only against <see cref="ICaseStudyRepository"/> (not the legacy god context). Owner: Case
/// Study. Removal criterion: Case Study owner API or a Valuation-local projection.
/// </para>
/// </summary>
public sealed class CaseStudyPropertyPoNumberLookup : IPropertyPoNumberLookup
{
    private readonly ICaseStudyRepository _db;

    public CaseStudyPropertyPoNumberLookup(ICaseStudyRepository db) => _db = db;

    public async Task<string> ResolveForPropertyAsync(
        string propertyId,
        CancellationToken cancellationToken = default)
    {
        if (!Guid.TryParse(propertyId, out var id))
            return "";

        var poNumber = await _db.WorkOrderProperties.AsNoTracking()
            .Where(p => p.Id == id)
            .Select(p => p.WorkOrder!.PoNumber)
            .FirstOrDefaultAsync(cancellationToken);

        return poNumber ?? "";
    }
}
