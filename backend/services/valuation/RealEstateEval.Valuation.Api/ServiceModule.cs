using RealEstateEval.Infrastructure;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Integration;
using RealEstateEval.Infrastructure.Web;
using RealEstateEval.Shared.Web;

namespace RealEstateEval.Valuation.Api;

public sealed class ServiceModule : IRealEstateEvalServiceModule
{
    public string ServiceName => "valuation";
    public string OpenApiTitle => "Valuation API";
    public string? ConnectionStringKey => ServiceDatabaseNames.Valuation;

    public void ConfigureHostOptions(RealEstateEvalApiHostOptions options) =>
        options.AddValidation = false;

    public void ConfigureBuilder(WebApplicationBuilder builder, string? connectionString)
    {
        builder.RequireEventBrokerInProduction();
        builder.Services.AddHostSharedInfrastructure(builder.Configuration, builder.Environment);
        builder.Services.AddClaimsPermissionService();
        builder.Services.AddValuationInfrastructure(builder.Configuration, connectionString!);
        builder.Services.Configure<OutboxDispatcherOptions>(o => o.ContextType = typeof(ValuationDbContext));
        builder.Services.AddOutboxDispatcher(builder.Configuration, builder.Environment);
    }

    public Task ConfigureAppAsync(WebApplication app, string? connectionString)
    {
        app.MapDatabaseReady<ValuationDbContext>(ServiceName);
        return Task.CompletedTask;
    }
}
