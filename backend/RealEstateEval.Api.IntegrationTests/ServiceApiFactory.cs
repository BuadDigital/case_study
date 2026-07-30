using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;

namespace RealEstateEval.Api.IntegrationTests;

/// <summary>
/// Boots a domain service the way production does — real pipeline, real authorization policies —
/// with the JWT handler swapped for <see cref="TestAuthHandler"/>.
/// <para>
/// Everything is passed as host settings rather than environment variables: a factory that mutated
/// the process environment would leak into every other test in the run.
/// </para>
/// <para>
/// The connection string points at a database that is never reached: these tests assert what the
/// pipeline decides before a handler touches storage — authentication, capability policies, and
/// request validation. Anything that needs data lives in the container test project, which runs
/// against a real Postgres.
/// </para>
/// </summary>
public abstract class ServiceApiFactory<TEntryPoint> : WebApplicationFactory<TEntryPoint>
    where TEntryPoint : class
{
    public const string TestSigningKey =
        "integration-test-signing-key-that-is-at-least-sixty-four-characters-long-1234567890";

    /// <summary>Matches the key the service reads, e.g. <c>ConnectionStrings:Operations</c>.</summary>
    protected abstract string ServiceName { get; }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Production");
        builder.UseSetting(
            $"ConnectionStrings:{ServiceName}",
            $"Host=localhost;Database={ServiceName.ToLowerInvariant()}_integration_test");
        builder.UseSetting("Jwt:SigningKey", TestSigningKey);
        builder.UseSetting("Redis:Enabled", "false");
        builder.UseSetting("RabbitMQ:Enabled", "false");

        builder.ConfigureTestServices(services =>
        {
            services.AddAuthentication(options =>
                {
                    options.DefaultAuthenticateScheme = TestAuthHandler.TestScheme;
                    options.DefaultChallengeScheme = TestAuthHandler.TestScheme;
                })
                .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(
                    TestAuthHandler.TestScheme,
                    _ => { });

            ConfigureServiceTestServices(services);
        });
    }

    protected virtual void ConfigureServiceTestServices(IServiceCollection services)
    {
    }
}
