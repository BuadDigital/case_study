using RealEstateEval.Gateway;
using RealEstateEval.Shared.Web;
var builder = WebApplication.CreateBuilder(args);
builder.AddRealEstateEvalObservability("gateway");
builder.Services.AddReverseProxy()
    .LoadFromConfig(builder.Configuration.GetSection("ReverseProxy"))
    .AddRealEstateEvalClientAddressForwarding();
builder.Services.AddResponseCompression(options => options.EnableForHttps = true);
builder.Services.AddRealEstateEvalCors(builder.Configuration, builder.Environment);
builder.Services.AddRealEstateEvalRateLimiting(builder.Configuration, builder.Environment);
builder.Services.AddGatewayUpstreamReadiness(builder.Configuration);
var app = builder.Build();
app.UseRealEstateEvalGatewayPipeline();
app.MapServiceHealth("gateway");
app.MapGatewayUpstreamReady("gateway");
app.MapReverseProxy();
app.Run();

public partial class Program;
