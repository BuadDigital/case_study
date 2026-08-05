using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using RealEstateEval.Application.Abstractions;

namespace RealEstateEval.Infrastructure.Services;

/// <summary>
/// Creates end-of-month vendor billing statements automatically (design §4.1).
/// Runs on the 1st–3rd UTC each month; CreateMonthVendorStatementsAsync is idempotent.
/// </summary>
public sealed class PartyBillingMonthVendorHostedService : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromHours(6);
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<PartyBillingMonthVendorHostedService> _logger;

    public PartyBillingMonthVendorHostedService(
        IServiceScopeFactory scopeFactory,
        ILogger<PartyBillingMonthVendorHostedService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            await Task.Delay(TimeSpan.FromSeconds(45), stoppingToken);
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            return;
        }

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var day = DateTime.UtcNow.Day;
                if (day is >= 1 and <= 3)
                {
                    using var scope = _scopeFactory.CreateScope();
                    var statements = scope.ServiceProvider
                        .GetRequiredService<IPartyBillingStatementService>();
                    var result = await statements.CreateMonthVendorStatementsAsync(
                        "system:month-vendor",
                        stoppingToken);
                    if (result.AssigneesCovered > 0)
                    {
                        _logger.LogInformation(
                            "Auto month vendor statements: {Count} assignees, {Lines} lines",
                            result.AssigneesCovered,
                            result.LinesIncluded);
                    }
                }
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                _logger.LogWarning(ex, "Month vendor statement sweep failed");
            }

            try
            {
                await Task.Delay(Interval, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
        }
    }
}
