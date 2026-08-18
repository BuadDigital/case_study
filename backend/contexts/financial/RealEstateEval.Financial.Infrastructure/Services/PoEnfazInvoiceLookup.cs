using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Infrastructure.Services;

public sealed class PoEnfazInvoiceLookup(FinancialDbContext db) : IPoEnfazInvoiceLookup
{
    public async Task<IReadOnlyList<string>> ListBilledPoNumbersAsync(
        IReadOnlyList<string> poNumbers,
        CancellationToken cancellationToken = default)
    {
        if (poNumbers.Count == 0)
            return [];

        var billed = await db.PoEnfazInvoices.AsNoTracking()
            .Where(i => poNumbers.Contains(i.PoNumber))
            .Select(i => i.PoNumber)
            .ToListAsync(cancellationToken);

        return billed.Select(p => p.Trim()).Distinct(StringComparer.Ordinal).ToList();
    }
}
