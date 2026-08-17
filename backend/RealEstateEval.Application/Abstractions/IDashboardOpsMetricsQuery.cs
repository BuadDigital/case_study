using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Application.Abstractions;

public interface IDashboardOpsMetricsQuery
{
    Task<DashboardOpsMetricsDto> GetAsync(CancellationToken cancellationToken = default);
}
