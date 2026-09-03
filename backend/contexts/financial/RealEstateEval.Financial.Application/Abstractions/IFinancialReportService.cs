using RealEstateEval.Application.Contracts;
using RealEstateEval.Financial.Application.Contracts;

namespace RealEstateEval.Financial.Application.Abstractions;

public interface IFinancialReportService
{
    Task<FinancialSummaryDto> GetSummaryAsync(CancellationToken cancellationToken = default);

    Task<FinancialSummaryDto> SaveSummaryAsync(
        FinancialSummaryDto request,
        CancellationToken cancellationToken = default);
}
