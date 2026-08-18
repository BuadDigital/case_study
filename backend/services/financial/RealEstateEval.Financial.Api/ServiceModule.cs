using FluentValidation;
using RealEstateEval.Application.Validation;
using RealEstateEval.Infrastructure;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Web;
using RealEstateEval.Shared.Web;

namespace RealEstateEval.Financial.Api;

public sealed class ServiceModule : IRealEstateEvalServiceModule
{
    public string ServiceName => "financial";
    public string OpenApiTitle => "Financial API";
    public string? ConnectionStringKey => ServiceDatabaseNames.Financial;

    public void ConfigureBuilder(WebApplicationBuilder builder, string? connectionString)
    {
        builder.Services.AddHostSharedInfrastructure(builder.Configuration, builder.Environment);
        builder.Services.AddClaimsPermissionService();
        builder.Services.AddFinancialInfrastructure(builder.Configuration, connectionString!);
        // A8: Financial boundary validators moved out of the globally scanned assembly.
        builder.Services.AddValidatorsFromAssemblyContaining<CreatePartyFeePricingTableRequestValidator>();
    }

    public Task ConfigureAppAsync(WebApplication app, string? connectionString)
    {
        app.MapDatabaseReady(
            ServiceName,
            typeof(FinancialDbContext));
        return Task.CompletedTask;
    }
}
