using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Infrastructure.Services;

public sealed class WorkOrderLoader : IWorkOrderLoader
{
    private readonly ApplicationDbContext _db;

    public WorkOrderLoader(ApplicationDbContext db)
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
            .Include(w => w.Properties)
            .ThenInclude(p => p.Contacts);

        if (asNoTracking) q = q.AsNoTracking();

        return await q.FirstOrDefaultAsync(w => w.PoNumber == po, cancellationToken);
    }
}
