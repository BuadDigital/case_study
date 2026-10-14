using RealEstateEval.CaseStudy.Application.Mapping;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Application.Services;
using RealEstateEval.CaseStudy.Infrastructure.Data.Contexts;

namespace RealEstateEval.CaseStudy.Infrastructure.Persistence;

/// <summary>
/// Case-study stream shell patch (no inspector-fee side effects). Failures pure host uses this
/// instead of the full <see cref="IWorkflowTaskService"/> graph, which still needs residual App fees.
/// Shares the request mapping and the post-patch notices with the lifecycle commands, so resolving
/// a failure tells the specialist «معاملة أُعيدت إليك» exactly like a supervisor's manual return.
/// </summary>
public sealed class WorkflowTaskShellPatcher(CaseStudyDbContext caseStudy,
    IWorkflowTaskPatchNotifier notifier,
    TimeProvider? time = null) : IWorkflowTaskShellPatcher
{
    private readonly TimeProvider _time = time ?? TimeProvider.System;

    public async Task<WorkflowTaskDto?> PatchAsync(
        Guid id,
        PatchWorkflowTaskRequest request,
        CancellationToken cancellationToken = default)
    {
        var entity = await caseStudy.WorkflowTasks.FirstOrDefaultAsync(t => t.Id == id, cancellationToken);
        if (entity is null) return null;

        var before = WorkflowTaskShellPatch.Apply(entity, request, _time.UtcNow());
        await caseStudy.SaveChangesAsync(cancellationToken);
        await notifier.NotifyAfterPatchAsync(entity, before, cancellationToken);
        return WorkflowTaskMapper.ToDto(entity);
    }
}
