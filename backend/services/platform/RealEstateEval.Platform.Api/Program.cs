using RealEstateEval.Infrastructure;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Web;
using RealEstateEval.Platform.Api.Integration;
using RealEstateEval.Shared.Web;

var builder = WebApplication.CreateBuilder(args);

builder.AddRealEstateEvalObservability("platform");

builder.Services
    .AddControllers()
    .AddRealEstateEvalValidation()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy =
            System.Text.Json.JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.Converters.Add(
            new System.Text.Json.Serialization.JsonStringEnumConverter());
    });

builder.Services.AddResponseCompression(options => options.EnableForHttps = true);

var connectionString = ServiceCollectionExtensions.RequireConnectionString(builder.Configuration,ServiceDatabaseNames.Platform);
builder.Services.AddHostSharedInfrastructure(builder.Configuration);
builder.Services.AddClaimsPermissionService();
builder.Services.AddPlatformInfrastructure(builder.Configuration, connectionString);
builder.Services.AddMessagingPersistence(builder.Configuration, connectionString);
// Residual cross-boundary reads for NotificationRecipientResolver (workflow assignee → user id).
// Replaced later by owner APIs.
builder.Services.AddCaseStudyPersistence(builder.Configuration, connectionString);
builder.Services.AddIdentityPersistence(builder.Configuration, connectionString);
builder.Services.AddPlatformNotificationInfrastructure(builder.Configuration, builder.Environment);
builder.Services.AddNotificationIntegrationHandlers();
builder.Services.AddIntegrationEventInbox();
builder.Services.AddHostedService<NotificationIntegrationEventConsumer>();
builder.Services.AddHostedService<NotificationRealtimeIntegrationConsumer>();
builder.Services.AddHostedService<PushDispatchIntegrationConsumer>();
builder.Services.AddRealEstateEvalJwt(builder.Configuration, builder.Environment);
builder.Services.AddRealEstateEvalCors(builder.Configuration, builder.Environment);
builder.Services.AddRealEstateEvalRateLimiting(builder.Configuration, builder.Environment);
builder.Services.AddRealEstateEvalOpenApi("Platform API");

var app = builder.Build();

app.UseRealEstateEvalServicePipeline();
app.UseRealEstateEvalOpenApi("Platform API");
app.MapServiceHealth("platform");
app.MapDatabaseReady(
    "platform",
    typeof(PlatformDbContext),
    typeof(MessagingDbContext),
    typeof(CaseStudyDbContext),
    typeof(IdentityDbContext));
app.MapControllers();

app.Run();

public partial class Program;
