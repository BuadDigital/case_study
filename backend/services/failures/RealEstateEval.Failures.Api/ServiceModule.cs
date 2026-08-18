using RealEstateEval.Infrastructure;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Web;
using RealEstateEval.Shared.Web;

namespace RealEstateEval.Failures.Api;

public sealed class ServiceModule : IRealEstateEvalServiceModule
{
    public string ServiceName => "failures";
    public string OpenApiTitle => "Failures API";
    public string? ConnectionStringKey => ServiceDatabaseNames.Failures;

    public void ConfigureBuilder(WebApplicationBuilder builder, string? connectionString)
    {
        builder.Services.AddHostSharedInfrastructure(builder.Configuration, builder.Environment);
        builder.Services.AddClaimsPermissionService();
        builder.Services.AddFailuresInfrastructure(
            builder.Configuration, connectionString!, builder.Environment);
    }

    public Task ConfigureAppAsync(WebApplication app, string? connectionString)
    {
        app.MapDatabaseReady(
            ServiceName,
            typeof(FailuresDbContext),
            typeof(CaseStudyDbContext),
            typeof(MessagingDbContext));
        return Task.CompletedTask;
    }
}
