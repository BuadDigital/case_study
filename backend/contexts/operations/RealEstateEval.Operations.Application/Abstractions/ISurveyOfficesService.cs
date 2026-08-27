using RealEstateEval.Application.Contracts;
using RealEstateEval.Operations.Application.Contracts;

namespace RealEstateEval.Operations.Application.Abstractions;

public interface ISurveyOfficesService
{
    Task<IReadOnlyList<SurveyOfficeDto>> ListAsync(CancellationToken cancellationToken = default);

    Task<SurveyOfficeDto?> GetAsync(Guid id, CancellationToken cancellationToken = default);
}
