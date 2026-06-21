using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Application.Abstractions;

public interface IFinancialReportService
{
    Task<FinancialSummaryDto> GetSummaryAsync(CancellationToken cancellationToken = default);

    Task<FinancialSummaryDto> SaveSummaryAsync(
        FinancialSummaryDto request,
        CancellationToken cancellationToken = default);
}
