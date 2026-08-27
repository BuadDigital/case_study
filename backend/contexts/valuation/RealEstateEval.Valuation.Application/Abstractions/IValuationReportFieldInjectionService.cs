using RealEstateEval.Application.Contracts;
using RealEstateEval.Valuation.Application.Contracts;

namespace RealEstateEval.Valuation.Application.Abstractions;

public interface IValuationReportFieldInjectionService
{
    Task<ValuationReportFieldPayloadDto?> GetPayloadAsync(
        Guid valuationRequestId,
        CancellationToken cancellationToken = default);
}
