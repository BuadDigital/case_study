using RealEstateEval.CaseStudy.Domain;

namespace RealEstateEval.CaseStudy.Application.Abstractions;

/// <summary>
/// Read port for the case-study form batch use case. Only the Infrastructure adapter opens EF;
/// every read is untracked. Deliberately narrow: two set-based reads, no per-id round trips.
/// </summary>
public interface ICaseStudyFormBatchQuery
{
    /// <summary>
    /// The parent tasks themselves, their children and their grandchildren — enough for the
    /// read gate (which looks at a task and its children) to run for parents and children alike
    /// without another query. Unknown ids are simply not returned.
    /// </summary>
    Task<IReadOnlyList<WorkflowTask>> ListParentFamiliesAsync(
        IReadOnlyCollection<Guid> parentTaskIds,
        CancellationToken cancellationToken);

    /// <summary>
    /// Case-study (non-party) forms of <paramref name="parentTaskIds"/> plus party forms of
    /// <paramref name="childTaskIds"/>, in one read.
    /// </summary>
    Task<IReadOnlyList<CaseStudyForm>> ListFormsAsync(
        IReadOnlyCollection<Guid> parentTaskIds,
        IReadOnlyCollection<Guid> childTaskIds,
        CancellationToken cancellationToken);
}
