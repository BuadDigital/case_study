using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using RealEstateEval.Infrastructure;
using RealEstateEval.Infrastructure.Integration;

namespace RealEstateEval.Api.IntegrationTests;

public class RabbitMqConfigurationValidationTests
{
    [Fact]
    public void RabbitMq_rejects_development_credentials_in_production()
    {
        var services = new ServiceCollection();
        services.AddValidatedRabbitMqOptions(
            BuildConfiguration("dev", "dev"),
            new TestHostEnvironment(Environments.Production));

        using var provider = services.BuildServiceProvider();

        Assert.Throws<OptionsValidationException>(
            () => provider.GetRequiredService<IOptions<RabbitMqOptions>>().Value);
    }

    [Fact]
    public void RabbitMq_accepts_explicit_production_credentials()
    {
        var services = new ServiceCollection();
        services.AddValidatedRabbitMqOptions(
            BuildConfiguration("ree-service", "strong-production-password"),
            new TestHostEnvironment(Environments.Production));

        using var provider = services.BuildServiceProvider();

        var options = provider.GetRequiredService<IOptions<RabbitMqOptions>>().Value;
        Assert.Equal("ree-service", options.UserName);
    }

    [Fact]
    public void RabbitMq_allows_disabled_broker_without_credentials()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["RabbitMQ:Enabled"] = "false",
            })
            .Build();
        var services = new ServiceCollection();
        services.AddValidatedRabbitMqOptions(
            configuration,
            new TestHostEnvironment(Environments.Production));

        using var provider = services.BuildServiceProvider();

        Assert.False(provider.GetRequiredService<IOptions<RabbitMqOptions>>().Value.Enabled);
    }

    private static IConfiguration BuildConfiguration(string userName, string password)
    {
        return new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["RabbitMQ:Enabled"] = "true",
                ["RabbitMQ:Host"] = "rabbitmq",
                ["RabbitMQ:UserName"] = userName,
                ["RabbitMQ:Password"] = password,
            })
            .Build();
    }

    private sealed class TestHostEnvironment(string environmentName) : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = environmentName;
        public string ApplicationName { get; set; } = nameof(RabbitMqConfigurationValidationTests);
        public string ContentRootPath { get; set; } = Directory.GetCurrentDirectory();
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
}
