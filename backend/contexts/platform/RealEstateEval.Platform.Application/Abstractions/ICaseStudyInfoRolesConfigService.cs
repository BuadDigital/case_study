using RealEstateEval.Application.Contracts;
using RealEstateEval.Platform.Application.Contracts;

namespace RealEstateEval.Platform.Application.Abstractions;

public interface ICaseStudyInfoRolesConfigService
{
    Task<CaseStudyInfoRolesConfigDto> GetAsync(CancellationToken cancellationToken = default);
    Task<CaseStudyInfoRolesConfigDto> SaveAsync(
        SaveCaseStudyInfoRolesRequest request,
        string actorId,
        CancellationToken cancellationToken = default);
}
