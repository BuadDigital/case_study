using RealEstateEval.CaseStudy.Application.Contracts;

namespace RealEstateEval.CaseStudy.Application.Abstractions;

public interface ICaseStudyReportBatchReadService
{
    /// <summary>
    /// Reads, for every parent in <paramref name="parentTaskIds"/>, the case-study form and the
    /// party forms of its children — the same rows <c>GET /api/case-study-reports/{id}</c> and
    /// <c>GET /api/case-study-reports/party/{id}</c> return one at a time, under the same
    /// visibility rule. Ids the actor may not read, or that do not exist, are left out.
    /// Duplicates collapse; more than <see cref="Services.CaseStudyReportBatchReadService.MaxParentTaskIds"/>
    /// distinct ids is an <see cref="ArgumentException"/>.
    /// </summary>
    Task<CaseStudyReportBatchDto> GetForParentsAsync(
        IReadOnlyCollection<Guid> parentTaskIds,
        CaseStudyReportActor? actor = null,
        CancellationToken cancellationToken = default);
}
