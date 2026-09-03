using Microsoft.EntityFrameworkCore;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Domain;
using RealEstateEval.CaseStudy.Infrastructure.Data.Contexts;

namespace RealEstateEval.CaseStudy.Infrastructure.Persistence;

public sealed class WorkflowTaskSlotRepository(CaseStudyDbContext db) : IWorkflowTaskSlotRepository
{
    public async Task<IReadOnlyList<WorkOrder>> ListWorkOrdersWithPropertiesAsync(
        CancellationToken cancellationToken) =>
        await db.WorkOrders
            .Include(w => w.Properties)
            .AsNoTracking()
            .ToListAsync(cancellationToken);

    public Task<List<WorkflowTask>> ListTasksForPoNumbersAsync(
        IReadOnlyCollection<string> poNumbers,
        CancellationToken cancellationToken) =>
        db.WorkflowTasks
            .Where(t => poNumbers.Contains(t.PoNumber))
            .ToListAsync(cancellationToken);

    public void AddTask(WorkflowTask task) => db.WorkflowTasks.Add(task);

    public async Task<bool> TrySaveChangesAsync(CancellationToken cancellationToken)
    {
        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return true;
        }
        catch (DbUpdateConcurrencyException)
        {
            db.ChangeTracker.Clear();
            return false;
        }
    }
}
