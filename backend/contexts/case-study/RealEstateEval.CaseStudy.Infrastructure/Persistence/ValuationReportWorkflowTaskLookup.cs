using Microsoft.EntityFrameworkCore;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Infrastructure.Data.Contexts;
using RealEstateEval.Domain;

namespace RealEstateEval.CaseStudy.Infrastructure.Persistence;

public sealed class ValuationReportWorkflowTaskLookup(CaseStudyDbContext db)
    : IValuationReportWorkflowTaskLookup
{
    public async Task<Guid?> FindOpenAppraisalTaskIdAsync(
        Guid propertyId,
        CancellationToken cancellationToken)
    {
        var id = await db.WorkflowTasks
            .Where(t => t.Kind == WorkflowTaskKind.PropertyAppraisal)
            .Where(t => t.PropertyId == propertyId)
            .Where(t => t.Status != WorkflowTaskStatus.Completed && t.Status != WorkflowTaskStatus.Cancelled)
            .OrderByDescending(t => t.UpdatedAtUtc)
            .Select(t => (Guid?)t.Id)
            .FirstOrDefaultAsync(cancellationToken);
        return id;
    }
}
