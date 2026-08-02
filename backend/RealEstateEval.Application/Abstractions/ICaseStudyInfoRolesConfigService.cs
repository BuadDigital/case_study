using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Application.Abstractions;

public interface ICaseStudyInfoRolesConfigService
{
    Task<CaseStudyInfoRolesConfigDto> GetAsync(CancellationToken cancellationToken = default);
    Task<CaseStudyInfoRolesConfigDto> SaveAsync(
        SaveCaseStudyInfoRolesRequest request,
        string actorId,
        CancellationToken cancellationToken = default);
}
