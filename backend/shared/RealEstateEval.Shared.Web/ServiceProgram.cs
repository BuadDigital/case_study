using RealEstateEval.Shared.Web;

var module = RealEstateEvalServiceModule.ResolveFrom(typeof(Program).Assembly);
var builder = WebApplication.CreateBuilder(args);
builder.AddRealEstateEvalApiHost(
    module.ServiceName,
    module.OpenApiTitle,
    module.ConfigureHostOptions);

string? connectionString = null;
if (module.ConnectionStringKey is { } key)
{
    connectionString = ServiceCollectionExtensions.RequireConnectionString(
        builder.Configuration,
        key,
        environment: builder.Environment);
}

module.ConfigureBuilder(builder, connectionString);

var app = builder.Build();
app.MapRealEstateEvalApiHost(module.ServiceName, module.OpenApiTitle);
await module.ConfigureAppAsync(app, connectionString);
app.MapControllers();
await app.RunAsync();
