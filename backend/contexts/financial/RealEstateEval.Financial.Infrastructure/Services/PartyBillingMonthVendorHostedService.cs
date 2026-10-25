using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Infrastructure.Services;

namespace RealEstateEval.Financial.Infrastructure.Services;

/// <summary>
/// Creates end-of-month vendor billing statements automatically (design ).
/// Runs on the 1st–3rd UTC each month; CreateMonthVendorStatementsAsync is idempotent.
/// </summary>
public sealed class PartyBillingMonthVendorHostedService : PeriodicSweepHostedService
{
    private readonly ILogger<PartyBillingMonthVendorHostedService> _logger;
    private readonly TimeProvider _time;

    public PartyBillingMonthVendorHostedService(
        IServiceScopeFactory scopeFactory,
        ILogger<PartyBillingMonthVendorHostedService> logger,
        TimeProvider? time = null)
        : base(scopeFactory, logger)
    {
        _time = time ?? TimeProvider.System;

        _logger = logger;
    }

    protected override TimeSpan InitialDelay { get; } = TimeSpan.FromSeconds(45);

    protected override TimeSpan Interval { get; } = TimeSpan.FromHours(6);

    protected override string SweepName => "Month vendor statement sweep";

    protected override async Task SweepAsync(IServiceProvider services, CancellationToken cancellationToken)
    {
        var day = _time.UtcNow().Day;
        if (day is < 1 or > 3)
            return;

        var statements = services.GetRequiredService<IPartyBillingStatementService>();
        var result = await statements.CreateMonthVendorStatementsAsync(
            "system:month-vendor",
            cancellationToken);
        if (result.AssigneesCovered > 0)
        {
            _logger.LogInformation(
                "Auto month vendor statements: {Count} assignees, {Lines} lines",
                result.AssigneesCovered,
                result.LinesIncluded);
        }
    }
}
