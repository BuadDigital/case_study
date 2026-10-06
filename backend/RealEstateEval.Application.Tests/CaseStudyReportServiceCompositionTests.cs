using System.Reflection;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.CaseStudy.Application.Abstractions;
using RealEstateEval.CaseStudy.Application.Services;
using RealEstateEval.CaseStudy.Infrastructure;
using RealEstateEval.Infrastructure;
using RealEstateEval.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// The 100% completeness rule is skipped by a report service built WITHOUT the info-roles lookup
/// (unit-test compositions). These tests are what make that safe: the case-study host's container
/// must hand the service its lookup, so production can never silently skip the check.
/// </summary>
public class CaseStudyReportServiceCompositionTests
{
    [Fact]
    public void The_remote_platform_catalogs_register_the_http_info_roles_lookup()
    {
        var services = new ServiceCollection();
        services.AddRemotePlatformCatalogs(Configuration());

        var descriptor = Assert.Single(services, d => d.ServiceType == typeof(ICaseStudyInfoRolesLookup));
        Assert.NotNull(descriptor);
        using var provider = services
            .AddHttpContextAccessor()
            .BuildServiceProvider();
        Assert.IsType<HttpCaseStudyInfoRolesLookup>(provider.GetRequiredService<ICaseStudyInfoRolesLookup>());
    }

    [Fact]
    public void The_case_study_host_registers_the_lookup_and_the_service_takes_it()
    {
        var services = new ServiceCollection();
        services.AddCaseStudyInfrastructure(Configuration(), new TestEnvironment());

        Assert.Contains(services, d => d.ServiceType == typeof(ICaseStudyInfoRolesLookup));
        Assert.Contains(
            services,
            d => d.ServiceType == typeof(ICaseStudyReportService)
                && d.ImplementationType == typeof(CaseStudyReportService));

        var ctor = typeof(CaseStudyReportService).GetConstructors(BindingFlags.Public | BindingFlags.Instance).Single();
        Assert.Contains(ctor.GetParameters(), p => p.ParameterType == typeof(ICaseStudyInfoRolesLookup));
        Assert.Contains(ctor.GetParameters(), p => p.ParameterType == typeof(ICaseStudyFailureGate));
        Assert.Contains(ctor.GetParameters(), p => p.ParameterType == typeof(IPropertyTimelineService));
        Assert.Contains(ctor.GetParameters(), p => p.ParameterType == typeof(IAuditLogAppend));
    }

    [Fact]
    public void The_resolved_report_service_enforces_the_completeness_rule()
    {
        var configuration = Configuration();
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddHttpContextAccessor();
        services.AddHostSharedInfrastructure(configuration, new TestEnvironment());
        services.AddCaseStudyPersistence(
            configuration,
            "Host=localhost;Database=ree_test;Username=test;Password=test");
        services.AddMessagingPersistence(
            configuration,
            "Host=localhost;Database=ree_test;Username=test;Password=test");
        services.AddClaimsPermissionService();
        services.AddCaseStudyInfrastructure(configuration, new TestEnvironment());

        using var provider = services.BuildServiceProvider();
        using var scope = provider.CreateScope();
        var service = Assert.IsType<CaseStudyReportService>(
            scope.ServiceProvider.GetRequiredService<ICaseStudyReportService>());

        Assert.True(service.EnforcesAnswerCompleteness);
    }

    private static IConfiguration Configuration() =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:CaseStudy"] = "Host=localhost;Database=ree_test;Username=test;Password=test",
                ["ConnectionStrings:Messaging"] = "Host=localhost;Database=ree_test;Username=test;Password=test",
                ["UpstreamServices:PlatformBaseUrl"] = "http://platform.test",
                ["UpstreamServices:AttachmentsBaseUrl"] = "http://attachments.test",
                ["UpstreamServices:IdentityBaseUrl"] = "http://identity.test",
                ["UpstreamServices:FailuresBaseUrl"] = "http://failures.test",
                ["UpstreamServices:ValuationBaseUrl"] = "http://valuation.test",
                ["UpstreamServices:FinancialBaseUrl"] = "http://financial.test",
                ["UpstreamServices:OperationsBaseUrl"] = "http://operations.test",
                ["UpstreamServices:CaseStudyBaseUrl"] = "http://case-study.test",
            })
            .Build();

    private sealed class TestEnvironment : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = Environments.Development;
        public string ApplicationName { get; set; } = "tests";
        public string ContentRootPath { get; set; } = AppContext.BaseDirectory;
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
}
