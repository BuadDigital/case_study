using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Domain;
using RealEstateEval.CaseStudy.Infrastructure.Data.Contexts;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Infrastructure.Persistence;

public sealed class WorkOrderLoader : IWorkOrderLoader
{
    private readonly CaseStudyDbContext _db;

    public WorkOrderLoader(CaseStudyDbContext db)
    {
        _db = db;
    }

    /// <summary>Loads one work order by PO number with its client, deeds, contacts and each deed's transaction.</summary>
    /// <remarks>
    /// How it works: normalises the PO, includes client → deeds → contacts, and deeds → transaction →
    /// all of that transaction's deeds (they may sit on other work orders), then
    /// returns the first match; tracked unless asNoTracking.
    /// Edge cases: the transaction → deeds → transaction include is a cycle a plain no-tracking query
    /// refuses, so the read-only path uses AsNoTrackingWithIdentityResolution.
    /// </remarks>
    public async Task<WorkOrder?> LoadAsync(
        string poNumber,
        CancellationToken cancellationToken = default,
        bool asNoTracking = false)
    {
        var po = IWorkOrderLoader.NormalizePo(poNumber);
        IQueryable<WorkOrder> q = _db.WorkOrders
            .Include(w => w.Client)
            .Include(w => w.Properties)
            .ThenInclude(p => p.Contacts)
            .Include(w => w.Properties)
            .ThenInclude(p => p.Transaction)
            .ThenInclude(t => t!.Properties);

        // Identity resolution: the transaction → properties → transaction include is a cycle a
        // plain no-tracking query refuses.
        if (asNoTracking) q = q.AsNoTrackingWithIdentityResolution();

        return await q.FirstOrDefaultAsync(w => w.PoNumber == po, cancellationToken);
    }
}
