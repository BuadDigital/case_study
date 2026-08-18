using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace RealEstateEval.Infrastructure.Data;

public class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<ApplicationDbContext>
{
    public ApplicationDbContext CreateDbContext(string[] args)
    {
        var apiProject = ResolveCaseStudyApiPath();
        var configuration = new ConfigurationBuilder()
            .SetBasePath(apiProject)
            .AddJsonFile("appsettings.json", optional: true)
            .AddJsonFile("appsettings.Development.json", optional: true)
            .AddEnvironmentVariables()
            .Build();

        var connectionString =
            Environment.GetEnvironmentVariable(
                BoundedContextConnections.EnvVarFor(BoundedContextConnections.ServiceNames.CaseStudy))
            ?? configuration.GetConnectionString(BoundedContextConnections.ServiceNames.CaseStudy)
            ?? "Host=localhost;Database=realestate_eval_design_time;Username=postgres;Password=postgres";

        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(connectionString)
            .Options;

        return new ApplicationDbContext(options);
    }

    private static string ResolveCaseStudyApiPath()
    {
        var dir = Directory.GetCurrentDirectory();
        while (!string.IsNullOrEmpty(dir))
        {
            var direct = Path.Combine(dir, "services", "case-study", "RealEstateEval.CaseStudy.Api");
            if (File.Exists(Path.Combine(direct, "appsettings.json")))
                return direct;

            var viaBackend = Path.Combine(dir, "backend", "services", "case-study", "RealEstateEval.CaseStudy.Api");
            if (File.Exists(Path.Combine(viaBackend, "appsettings.json")))
                return viaBackend;

            dir = Directory.GetParent(dir)?.FullName ?? "";
        }

        throw new InvalidOperationException(
            "Could not locate RealEstateEval.CaseStudy.Api appsettings for EF design-time.");
    }
}
