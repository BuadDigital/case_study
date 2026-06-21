using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Application.Abstractions;

public interface ISurveyOfficesService
{
    Task<IReadOnlyList<SurveyOfficeDto>> ListAsync(CancellationToken cancellationToken = default);

    Task<SurveyOfficeDto?> GetAsync(Guid id, CancellationToken cancellationToken = default);

    Task<SurveyOfficeDto> CreateAsync(
        SaveSurveyOfficeRequest request,
        CancellationToken cancellationToken = default);

    Task<SurveyOfficeDto?> UpdateAsync(
        Guid id,
        SaveSurveyOfficeRequest request,
        CancellationToken cancellationToken = default);

    Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken = default);
}
