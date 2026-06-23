using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using RealEstateEval.Infrastructure;
using RealEstateEval.Infrastructure.Data;

var login = args.Length > 0 ? args[0] : "ahmed";
var root = Directory.GetCurrentDirectory();
var apiDir = Path.Combine(root, "backend", "services", "identity", "RealEstateEval.Identity.Api");

var config = new ConfigurationBuilder()
    .SetBasePath(apiDir)
    .AddJsonFile("appsettings.json", optional: false)
    .AddJsonFile("appsettings.Development.json", optional: true)
    .Build();

var connectionString = config.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException("Missing DefaultConnection");

var services = new ServiceCollection();
services.AddLogging();
services.AddPersistence(config, connectionString);
services.AddIdentityInfrastructure();

await using var provider = services.BuildServiceProvider();
await DataSeeder.ReseedHrStaffByLoginAsync(provider, login);
Console.WriteLine($"[reseed] restored HR demo user '{login}'.");
