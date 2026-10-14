using RealEstateEval.CaseStudy.Application.Services;
using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Application.Abstractions;

/// <summary>
/// The notices a shell patch owes once it is saved. Shared by the supervisor's manual patch
/// and the stream shell patcher (failure escalate / resolve) so a task moved the same way
/// tells the same people, whichever path moved it.
/// </summary>
public interface IWorkflowTaskPatchNotifier
{
    Task NotifyAfterPatchAsync(
        WorkflowTask task,
        WorkflowTaskPatchSnapshot before,
        CancellationToken cancellationToken);
}
