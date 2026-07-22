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
            services.RemoveAll<IPartyFeePricingService>();
            services.AddSingleton<IPartyFeePricingService, StubPartyFeePricingService>();

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

internal sealed class StubPartyFeePricingService : IPartyFeePricingService
{
    public Task<IReadOnlyList<PartyFeePricingTableSummaryDto>> ListAsync(
        string? category = null,
        CancellationToken cancellationToken = default)
        => Task.FromResult<IReadOnlyList<PartyFeePricingTableSummaryDto>>(
        [
            new PartyFeePricingTableSummaryDto
            {
                Id = Sample().Id,
                Category = category ?? "engineering-survey",
                Name = Sample().Name,
                IsActive = true,
            },
        ]);

    public Task<PartyFeePricingDto> GetActiveAsync(CancellationToken cancellationToken = default)
        => Task.FromResult(Sample());

    public Task<PartyFeePricingDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
        => Task.FromResult<PartyFeePricingDto?>(id == Sample().Id ? Sample() : null);

    public Task<PartyFeePricingDto> CreateAsync(
        CreatePartyFeePricingTableRequest request,
        CancellationToken cancellationToken = default)
    {
        var row = Sample();
        row.Id = Guid.NewGuid();
        row.Category = string.IsNullOrWhiteSpace(request.Category)
            ? row.Category
            : request.Category.Trim();
        row.Name = string.IsNullOrWhiteSpace(request.Name) ? row.Name : request.Name.Trim();
        row.IsActive = false;
        return Task.FromResult(row);
    }

    public Task<PartyFeePricingDto> SaveAsync(
        Guid id,
        PartyFeePricingDto request,
        CancellationToken cancellationToken = default)
    {
        request.Id = id;
        return Task.FromResult(request);
    }

    public Task<PartyFeePricingDto> ActivateAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var row = Sample();
        row.Id = id;
        row.IsActive = true;
        return Task.FromResult(row);
    }

    public Task<bool> DeleteAsync(Guid id, CancellationToken cancellationToken = default)
        => Task.FromResult(true);

    public Task<IReadOnlyList<string>> ListAssignmentsAsync(
        Guid tableId,
        CancellationToken cancellationToken = default)
        => Task.FromResult<IReadOnlyList<string>>([]);

    public Task<PartyFeePricingDto> SetAssignmentsAsync(
        Guid tableId,
        IReadOnlyList<string> assigneeIds,
        CancellationToken cancellationToken = default)
    {
        var row = Sample();
        row.Id = tableId;
        row.AssignedAssigneeIds = assigneeIds.ToList();
        row.AssignedCount = assigneeIds.Count;
        return Task.FromResult(row);
    }

    public Task<decimal?> ResolveDefaultFeeAsync(
        string taskKind,
        string partyType,
        decimal? areaM2 = null,
        string? assigneeId = null,
        CancellationToken cancellationToken = default)
        => Task.FromResult<decimal?>(0m);

    private static PartyFeePricingDto Sample() => new()
    {
        Id = Guid.Parse("a1b2c3d4-e5f6-7890-abcd-ef1234567890"),
        Category = "engineering-survey",
        Name = "التسعيرة الافتراضية",
        IsActive = true,
        AreaTiers =
        [
            new PartyFeePricingTierDto { SortOrder = 0, MaxAreaM2 = 500, FeeSar = 300 },
            new PartyFeePricingTierDto { SortOrder = 1, MaxAreaM2 = 1000, FeeSar = 450 },
            new PartyFeePricingTierDto { SortOrder = 2, MaxAreaM2 = 1500, FeeSar = 900 },
            new PartyFeePricingTierDto { SortOrder = 3, MaxAreaM2 = 10000, FeeSar = 1500 },
            new PartyFeePricingTierDto { SortOrder = 4, MaxAreaM2 = null, FeeSar = 4000 },
        ],
        GovernmentReviewFeeSar = 350,
        KeyReceiptFeeSar = 350,
        FieldInspectorIndividualFeeSar = 400,
        FieldInspectorOrganizationFeeSar = 500,
    };
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
