using RealEstateEval.CaseStudy.Application.Contracts;

namespace RealEstateEval.CaseStudy.Application.Abstractions;

public interface ICaseStudyFormBatchReadService
{
    /// <summary>
    /// Reads, for every parent in <paramref name="parentTaskIds"/>, the case-study form and the
    /// party forms of its children — the same rows <c>GET /api/case-study-forms/{id}</c> and
    /// <c>GET /api/case-study-forms/party/{id}</c> return one at a time, under the same
    /// visibility rule. Ids the actor may not read, or that do not exist, are left out.
    /// Duplicates collapse; more than <see cref="Services.CaseStudyFormBatchReadService.MaxParentTaskIds"/>
    /// distinct ids is an <see cref="ArgumentException"/>.
    /// </summary>
    Task<CaseStudyFormBatchDto> GetForParentsAsync(
        IReadOnlyCollection<Guid> parentTaskIds,
        CaseStudyFormActor? actor = null,
        CancellationToken cancellationToken = default);
}
