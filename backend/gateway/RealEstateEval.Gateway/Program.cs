using RealEstateEval.Gateway;
using RealEstateEval.Shared.Web;
var builder = WebApplication.CreateBuilder(args);
builder.AddRealEstateEvalObservability("gateway");
// Report PDF rendering posts the browser-built report HTML (photos as data URLs) through the
// gateway; Kestrel's 30 MB default would reject it before the valuation service sees it.
builder.WebHost.ConfigureKestrel(kestrel =>
    kestrel.Limits.MaxRequestBodySize = 80L * 1024 * 1024);
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
