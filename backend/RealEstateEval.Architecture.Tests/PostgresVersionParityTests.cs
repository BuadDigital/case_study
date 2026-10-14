using RealEstateEval.Architecture.Tests.Support;

namespace RealEstateEval.Architecture.Tests;

public class PostgresVersionParityTests
{
    private const string Image = "postgres:17.5-alpine";

    [Fact]
    public void Testcontainers_and_deployment_use_the_same_postgresql_image()
    {
        var fixture = File.ReadAllText(RepoPaths.Combine(
            "backend",
            "RealEstateEval.Api.ContainerTests",
            "PostgresFixture.cs"));
        var development = File.ReadAllText(RepoPaths.Combine(
            "infra",
            "docker-compose.yml"));
        var production = File.ReadAllText(RepoPaths.Combine(
            "infra",
            "docker-compose.prod.yml"));

        Assert.Contains(Image, fixture, StringComparison.Ordinal);
        Assert.Contains($"image: {Image}", development, StringComparison.Ordinal);
        Assert.Contains($"image: {Image}", production, StringComparison.Ordinal);
    }
}
