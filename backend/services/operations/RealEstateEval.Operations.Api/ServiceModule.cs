using FluentValidation;
using RealEstateEval.Application.Validation;
using RealEstateEval.Infrastructure;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Web;
using RealEstateEval.Shared.Web;

namespace RealEstateEval.Operations.Api;

public sealed class ServiceModule : IRealEstateEvalServiceModule
{
    public string ServiceName => "operations";
    public string OpenApiTitle => "Operations API";
    public string? ConnectionStringKey => ServiceDatabaseNames.Operations;

    public void ConfigureBuilder(WebApplicationBuilder builder, string? connectionString)
    {
        builder.Services.AddHostSharedInfrastructure(builder.Configuration, builder.Environment);
        builder.Services.AddClaimsPermissionService();
        builder.Services.AddOperationsInfrastructure(
            builder.Configuration, connectionString!, builder.Environment);
        // A8: Operations boundary validators moved out of the globally scanned assembly.
        builder.Services.AddValidatorsFromAssemblyContaining<CreateOperationsTaskRequestValidator>();
    }

    public Task ConfigureAppAsync(WebApplication app, string? connectionString)
    {
        app.MapDatabaseReady(
            ServiceName,
            typeof(OperationsDbContext),
            typeof(MessagingDbContext));
        return Task.CompletedTask;
    }
}
