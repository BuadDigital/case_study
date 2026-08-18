using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Infrastructure.Services;

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
            .ThenInclude(p => p.Contacts);

        if (asNoTracking) q = q.AsNoTracking();

        return await q.FirstOrDefaultAsync(w => w.PoNumber == po, cancellationToken);
    }
}
