using RealEstateEval.Architecture.Tests.Support;

namespace RealEstateEval.Architecture.Tests;

public class PostgresConnectionBudgetDeploymentTests
{
    [Fact]
    public void Production_compose_enforces_the_reviewed_connection_budget()
    {
        var compose = File.ReadAllText(RepoPaths.Combine(
            "infra",
            "docker-compose.prod.yml"));
        var rollout = File.ReadAllText(RepoPaths.Combine("infra", "rollout.sh"));
        var migrator = File.ReadAllText(RepoPaths.Combine(
            "backend",
            "tools",
            "DbMigrate",
            "Program.cs"));
        var deploy = File.ReadAllText(RepoPaths.Combine(
            ".github",
            "workflows",
            "deploy.yml"));

        Assert.Contains(
            "command: [\"postgres\", \"-c\", \"max_connections=500\"]",
            compose,
            StringComparison.Ordinal);
        Assert.Contains("Database__MaxPoolSize: \"6\"", compose, StringComparison.Ordinal);
        Assert.Contains(
            "Database__ServerMaxConnections: \"500\"",
            compose,
            StringComparison.Ordinal);
        Assert.Contains(
            "Database__ReservedServerConnections: \"40\"",
            compose,
            StringComparison.Ordinal);
        Assert.Contains(
            "Database__PeakApplicationPoolCount: \"26\"",
            compose,
            StringComparison.Ordinal);
        Assert.Equal(9, compose.Split("*database-env", StringSplitOptions.None).Length - 1);
        Assert.Contains(
            "--scale \"$svc=$((count * 2))\"",
            rollout,
            StringComparison.Ordinal);
        Assert.Contains(
            "NpgsqlConfiguration.EnhanceConnectionString",
            migrator,
            StringComparison.Ordinal);
        var postgresRaised = deploy.IndexOf(
            "up -d --wait --no-deps postgres",
            StringComparison.Ordinal);
        var migrations = deploy.IndexOf(
            "run --rm migrate",
            StringComparison.Ordinal);
        Assert.True(postgresRaised >= 0 && postgresRaised < migrations);
    }
}
