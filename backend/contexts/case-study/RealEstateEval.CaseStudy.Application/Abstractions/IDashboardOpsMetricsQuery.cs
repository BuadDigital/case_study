using RealEstateEval.Application.Contracts;

namespace RealEstateEval.CaseStudy.Application.Abstractions;

public interface IDashboardOpsMetricsQuery
{
    Task<DashboardOpsMetricsDto> GetAsync(CancellationToken cancellationToken = default);
}
