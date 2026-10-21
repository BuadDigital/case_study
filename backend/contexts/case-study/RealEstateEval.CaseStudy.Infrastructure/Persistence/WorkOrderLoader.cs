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
