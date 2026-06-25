using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Application.Abstractions;

public interface IValuationRequestService
{
    Task<IReadOnlyList<ValuationRequestDto>> ListAsync(CancellationToken cancellationToken = default);
    Task<ValuationRequestDto?> GetAsync(Guid id, CancellationToken cancellationToken = default);
    Task<ValuationRequestDto> CreateAsync(
        SaveValuationRequestRequest request,
        CancellationToken cancellationToken = default);
    Task<ValuationRequestDto?> UpdateAsync(
        Guid id,
        SaveValuationRequestRequest request,
        CancellationToken cancellationToken = default);
    Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken = default);
    Task<(ValuationRequestDto? Result, string? Error)> SubmitReportAsync(
        Guid id,
        CancellationToken cancellationToken = default);
    Task<(ValuationRequestDto? Result, string? Error)> RecordImpedimentAsync(
        Guid id,
        ValuationImpedimentRequest request,
        CancellationToken cancellationToken = default);
}
