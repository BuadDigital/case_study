using FluentValidation;
using RealEstateEval.Application.Validation;
using RealEstateEval.Infrastructure;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Web;
using RealEstateEval.Shared.Web;
using RealEstateEval.Failures.Infrastructure;
using RealEstateEval.Failures.Application.Validation;
using RealEstateEval.Failures.Infrastructure.Data.Contexts;

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
        // A8: the failure request validators live in the Failures context assembly, outside
        // the global-Application scan in AddRealEstateEvalValidation.
        builder.Services.AddValidatorsFromAssemblyContaining<CreateFailureRequestValidator>();
    }

    public Task ConfigureAppAsync(WebApplication app, string? connectionString)
    {
        app.MapDatabaseReady(
            ServiceName,
            typeof(FailuresDbContext),
            typeof(MessagingDbContext));
        return Task.CompletedTask;
    }
}
