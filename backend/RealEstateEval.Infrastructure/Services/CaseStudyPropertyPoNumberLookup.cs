using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Infrastructure.Services;

/// <summary>
/// Phase-1 bridge for the one Case Study value the Valuation context still needs.
/// <para>
/// The read stays on the legacy context because Case Study has not been extracted yet, but it
/// is now behind an owner interface, outside the Valuation transaction, and read-only.
/// Owner: Case Study. Removal criterion: replaced by a Case Study owner API or a
/// Valuation-local projection when Phase 3 removes cross-boundary database access.
/// </para>
/// </summary>
public sealed class CaseStudyPropertyPoNumberLookup : IPropertyPoNumberLookup
{
    private readonly ApplicationDbContext _db;

    public CaseStudyPropertyPoNumberLookup(ApplicationDbContext db) => _db = db;

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
