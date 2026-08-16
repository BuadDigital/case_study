using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Application.Abstractions;

public interface IValuationReportFieldInjectionService
{
    Task<ValuationReportFieldPayloadDto?> GetPayloadAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken = default);
}
