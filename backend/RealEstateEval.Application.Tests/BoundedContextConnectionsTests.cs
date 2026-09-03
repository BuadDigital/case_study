using Microsoft.Extensions.Configuration;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Attachments.Infrastructure.Data.Contexts;
using RealEstateEval.Identity.Infrastructure.Data.Contexts;
using RealEstateEval.Platform.Infrastructure.Data.Contexts;
using RealEstateEval.Valuation.Infrastructure.Data.Contexts;
using RealEstateEval.Failures.Infrastructure.Data.Contexts;
using RealEstateEval.Operations.Infrastructure.Data.Contexts;
using RealEstateEval.Financial.Infrastructure.Data.Contexts;
using RealEstateEval.CaseStudy.Infrastructure.Data.Contexts;

namespace RealEstateEval.Application.Tests;

public class BoundedContextConnectionsTests
{
    private static readonly object EnvGate = new();

    [Fact]
    public void Dedicated_env_var_wins_over_any_leftover_string()
    {
        lock (EnvGate)
        {
            AssertDedicatedWins(
                BoundedContextConnections.ServiceNames.Attachments,
                typeof(AttachmentsDbContext),
                "realestate_eval_attachments");
            AssertDedicatedWins(
                BoundedContextConnections.ServiceNames.Identity,
                typeof(IdentityDbContext),
                "realestate_eval_identity");
            AssertDedicatedWins(
                BoundedContextConnections.ServiceNames.Platform,
                typeof(PlatformDbContext),
                "realestate_eval_platform");
            AssertDedicatedWins(
                BoundedContextConnections.ServiceNames.Valuation,
                typeof(ValuationDbContext),
                "realestate_eval_valuation");
            AssertDedicatedWins(
                BoundedContextConnections.ServiceNames.Failures,
                typeof(FailuresDbContext),
                "realestate_eval_failures");
            AssertDedicatedWins(
                BoundedContextConnections.ServiceNames.Operations,
                typeof(OperationsDbContext),
                "realestate_eval_operations");
            AssertDedicatedWins(
                BoundedContextConnections.ServiceNames.Financial,
                typeof(FinancialDbContext),
                "realestate_eval_financial");
            AssertDedicatedWins(
                BoundedContextConnections.ServiceNames.CaseStudy,
                typeof(CaseStudyDbContext),
                "realestate_eval_case_study");
            AssertDedicatedWins(
                BoundedContextConnections.ServiceNames.Messaging,
                typeof(MessagingDbContext),
                "realestate_eval_messaging");
        }
    }

    private static void AssertDedicatedWins(string serviceName, Type contextType, string database)
    {
        var name = BoundedContextConnections.EnvVarFor(serviceName);
        var previous = Environment.GetEnvironmentVariable(name);
        try
        {
            Environment.SetEnvironmentVariable(name, $"Host=db;Database={database}");
            var configuration = new ConfigurationBuilder().Build();
            var resolved = BoundedContextConnections.ForContext(configuration, contextType);
            Assert.Contains(database, resolved, StringComparison.Ordinal);
        }
        finally
        {
            Environment.SetEnvironmentVariable(name, previous);
        }
    }

    [Fact]
    public void Missing_dedicated_connection_throws()
    {
        var name = BoundedContextConnections.EnvVarFor(BoundedContextConnections.ServiceNames.Messaging);
        lock (EnvGate)
        {
            var previous = Environment.GetEnvironmentVariable(name);
            try
            {
                Environment.SetEnvironmentVariable(name, null);
                var configuration = new ConfigurationBuilder().Build();

                var ex = Assert.Throws<InvalidOperationException>(
                    () => BoundedContextConnections.ForContext<MessagingDbContext>(configuration));
                Assert.Contains("ConnectionStrings:Messaging", ex.Message, StringComparison.Ordinal);
            }
            finally
            {
                Environment.SetEnvironmentVariable(name, previous);
            }
        }
    }

    [Fact]
    public void ApplyDedicatedSettings_sets_every_owner()
    {
        var set = new Dictionary<string, string?>(StringComparer.Ordinal);
        BoundedContextConnections.ApplyDedicatedSettings(
            (key, value) => set[key] = value,
            "Host=db;Database=test");

        Assert.Equal(BoundedContextConnections.ServiceNames.All.Length, set.Count);
        foreach (var name in BoundedContextConnections.ServiceNames.All)
            Assert.Equal("Host=db;Database=test", set[$"ConnectionStrings:{name}"]);
    }
}
