using RealEstateEval.Architecture.Tests.Support;

namespace RealEstateEval.Architecture.Tests;

public class CommandIdempotencyHostTests
{
    [Theory]
    [InlineData(
        "identity",
        "RealEstateEval.Identity.Infrastructure",
        "IdentityDependencyInjection.cs",
        "IdentityDbContext")]
    [InlineData(
        "valuation",
        "RealEstateEval.Valuation.Infrastructure",
        "ValuationDependencyInjection.cs",
        "ValuationDbContext")]
    [InlineData(
        "attachments",
        "RealEstateEval.Attachments.Infrastructure",
        "AttachmentsDependencyInjection.cs",
        "AttachmentsDbContext")]
    public void Owner_only_hosts_register_durable_command_idempotency(
        string contextDirectory,
        string projectDirectory,
        string fileName,
        string contextType)
    {
        var source = File.ReadAllText(RepoPaths.Combine(
            "backend",
            "contexts",
            contextDirectory,
            projectDirectory,
            fileName));

        Assert.Contains(
            $"AddOwnerCommandIdempotencyPersistence<{contextType}>",
            source,
            StringComparison.Ordinal);
    }
}
