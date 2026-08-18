using Microsoft.EntityFrameworkCore;
using RealEstateEval.Infrastructure;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Web;
using RealEstateEval.Shared.Web;

namespace RealEstateEval.Identity.Api;

public sealed class ServiceModule : IRealEstateEvalServiceModule
{
    public string ServiceName => "identity";
    public string OpenApiTitle => "Identity API";
    public string? ConnectionStringKey => ServiceDatabaseNames.Identity;

    public void ConfigureHostOptions(RealEstateEvalApiHostOptions options) =>
        options.CamelCasePropertyNames = true;

    public void ConfigureBuilder(WebApplicationBuilder builder, string? connectionString)
    {
        var enableDevLogin = builder.Configuration.GetValue("Auth:EnableDevLogin", false);
        if (enableDevLogin && !builder.Environment.IsDevelopment())
        {
            throw new InvalidOperationException(
                "Auth:EnableDevLogin is only allowed in Development.");
        }

        builder.Services.AddHostSharedInfrastructure(builder.Configuration, builder.Environment);
        builder.Services.AddIdentityInfrastructure(builder.Configuration, connectionString!);
    }

    public async Task ConfigureAppAsync(WebApplication app, string? connectionString)
    {
        if (app.Environment.IsDevelopment())
        {
            await using var scope = app.Services.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<IdentityDbContext>();
            await PostgresDatabaseProvisioner.EnsureExistsAsync(db.Database.GetConnectionString());
        }

        app.MapDatabaseReady<IdentityDbContext>(ServiceName);
    }
}
