using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.Infrastructure.Services;

namespace RealEstateEval.CaseStudy.Infrastructure.Services;

/// <summary>
/// Every minute: widens untaken appraiser reassignment requests to the team after the head start, and
/// sends the end-of-day reminder (Omar 2026-11-18). The rules are in <see cref="IAppraiserHandoverService.SweepAsync"/>.
/// </summary>
public sealed class AppraiserHandoverSweepHostedService(
    IServiceScopeFactory scopeFactory,
    ILogger<AppraiserHandoverSweepHostedService> logger)
    : PeriodicSweepHostedService(scopeFactory, logger)
{
    protected override TimeSpan InitialDelay { get; } = TimeSpan.FromSeconds(30);

    protected override TimeSpan Interval { get; } = TimeSpan.FromMinutes(1);

    protected override string SweepName => "Appraiser handover sweep";

    protected override Task SweepAsync(IServiceProvider services, CancellationToken cancellationToken) =>
        services.GetRequiredService<IAppraiserHandoverService>().SweepAsync(cancellationToken);
}
