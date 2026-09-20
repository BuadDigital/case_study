using RealEstateEval.Architecture.Tests.Support;

namespace RealEstateEval.Architecture.Tests;

/// <summary>
/// ADR 0002 remainder: owner-bound types leave the global Application assembly.
/// Shared primitives that two or more contexts need live in Shared.Contracts.
/// </summary>
public class SharedAssemblyRemainderTests
{
    [Fact]
    public void Global_application_has_no_fluentvalidation_validators()
    {
        var validationDir = RepoPaths.Combine(
            "backend", "RealEstateEval.Application", "Validation");
        var files = Directory.Exists(validationDir)
            ? RepoPaths.CSharpFiles(validationDir)
            : [];

        Assert.True(
            files.Count == 0,
            "Owner FluentValidation types belong in the owner Application assembly "
            + "(Identity / Financial / Operations / …), not global Application. Found:\n  "
            + string.Join("\n  ", files.Select(RepoPaths.Relative)));
    }

    [Fact]
    public void TimeProvider_and_cache_ports_live_in_shared_contracts()
    {
        var contracts = RepoPaths.Combine(
            "backend", "shared", "RealEstateEval.Shared.Contracts");

        Assert.True(
            File.Exists(Path.Combine(contracts, "TimeProviderExtensions.cs")),
            "TimeProviderExtensions belongs in Shared.Contracts so context libraries "
            + "do not reference global Application just for time.UtcNow().");
        Assert.True(
            File.Exists(Path.Combine(contracts, "Abstractions", "IResponseCache.cs")));
        Assert.True(
            File.Exists(Path.Combine(contracts, "Abstractions", "IIntegrationEventPublisher.cs")));
        Assert.False(
            File.Exists(RepoPaths.Combine(
                "backend", "RealEstateEval.Application", "TimeProviderExtensions.cs")));
    }

    [Fact]
    public void Billing_validators_live_in_financial_application()
    {
        var financial = File.ReadAllText(
            RepoPaths.Combine(
                "backend",
                "contexts",
                "financial",
                "RealEstateEval.Financial.Application",
                "Validation",
                "FinancialRequestValidators.cs"));

        Assert.Contains("class CreatePartyBillingStatementRequestValidator", financial, StringComparison.Ordinal);
        Assert.Contains("class SavePoEnfazBillingRequestValidator", financial, StringComparison.Ordinal);
    }

    [Fact]
    public void Identity_login_validators_live_in_identity_application()
    {
        var identity = File.ReadAllText(
            RepoPaths.Combine(
                "backend",
                "contexts",
                "identity",
                "RealEstateEval.Identity.Application",
                "Validation",
                "IdentityRequestValidators.cs"));

        Assert.Contains("class UsernameLoginRequestValidator", identity, StringComparison.Ordinal);
        Assert.Contains("class CreateStaffUserRequestValidator", identity, StringComparison.Ordinal);
    }
}
