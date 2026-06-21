extern alias FinancialApi;

using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;

namespace RealEstateEval.Api.IntegrationTests;

public sealed class FinancialApiWebApplicationFactory
    : WebApplicationFactory<FinancialApi::Program>
{
    public FinancialApiWebApplicationFactory()
    {
        Environment.SetEnvironmentVariable(
            "REAL_ESTATE_EVAL_PG_CONNECTION_STRING_FINANCIAL",
            "Host=localhost;Database=financial_integration_test");
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.ConfigureAppConfiguration((_, config) =>
        {
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Redis:Enabled"] = "false",
            });
        });

        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<IFinancialReportService>();
            services.AddSingleton<IFinancialReportService, StubFinancialReportService>();

            services.AddAuthentication(options =>
                {
                    options.DefaultAuthenticateScheme = TestAuthHandler.TestScheme;
                    options.DefaultChallengeScheme = TestAuthHandler.TestScheme;
                })
                .AddScheme<Microsoft.AspNetCore.Authentication.AuthenticationSchemeOptions, TestAuthHandler>(
                    TestAuthHandler.TestScheme,
                    _ => { });
        });
    }
}

internal sealed class StubFinancialReportService : IFinancialReportService
{
    public Task<FinancialSummaryDto> GetSummaryAsync(CancellationToken cancellationToken = default)
        => Task.FromResult(Sample());

    public Task<FinancialSummaryDto> SaveSummaryAsync(
        FinancialSummaryDto request,
        CancellationToken cancellationToken = default)
        => Task.FromResult(request);

    private static FinancialSummaryDto Sample() => new()
    {
        PeriodLabel = "يناير",
        RevenueTotal = "0",
        ExternalCostsTotal = "0",
        ProfitMarginTotal = "0",
        ProfitMarginPercentLabel = "0%",
        PendingPayablesTotal = "0",
        RevenueGrandTotal = "0",
        RevenueRows = [],
        CostRows = [],
    };
}
