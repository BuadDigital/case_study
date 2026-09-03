using RealEstateEval.Architecture.Tests.Support;

namespace RealEstateEval.Architecture.Tests;

/// <summary>
/// Ratchet on transaction-script growth. docs/architecture/solid-scorecard.md finding 1: use-case
/// orchestration sits in <c>contexts/*/Infrastructure/Services</c> next to EF. Files already over
/// the cap are frozen here; nothing new may join them, and a file that shrinks below the cap
/// must leave the list so it cannot regrow unnoticed.
/// </summary>
public class InfrastructureServiceSizeTests
{
    private const int MaxLines = 400;

    /// <summary>Snapshot taken 2026-09-02 after PartyTaskSubmissionService moved to Application.</summary>
    private static readonly string[] FrozenOverCap =
    [
        "backend/contexts/failures/RealEstateEval.Failures.Infrastructure/Services/FailureService.cs",
        "backend/contexts/financial/RealEstateEval.Financial.Infrastructure/Services/PartyBillingStatementService.cs",
        "backend/contexts/financial/RealEstateEval.Financial.Infrastructure/Services/PoEnfazBillingService.cs",
        "backend/contexts/identity/RealEstateEval.Identity.Infrastructure/Services/UserRegistrationService.cs",
        "backend/contexts/operations/RealEstateEval.Operations.Infrastructure/Services/KeyEnvelopesService.cs",
        "backend/contexts/operations/RealEstateEval.Operations.Infrastructure/Services/OperationsTaskCommands.cs",
        "backend/contexts/operations/RealEstateEval.Operations.Infrastructure/Services/OperationsTaskNotifier.cs",
        "backend/contexts/platform/RealEstateEval.Platform.Infrastructure/Services/CourtsService.cs",
        "backend/contexts/platform/RealEstateEval.Platform.Infrastructure/Services/OrganizationSettingsService.cs",
        "backend/contexts/platform/RealEstateEval.Platform.Infrastructure/Services/RegionsService.cs",
        "backend/contexts/valuation/RealEstateEval.Valuation.Infrastructure/Services/ComparablePropertyService.cs",
        "backend/contexts/valuation/RealEstateEval.Valuation.Infrastructure/Services/ValuationComparableSelectionService.cs",
        "backend/contexts/valuation/RealEstateEval.Valuation.Infrastructure/Services/ValuationCostApproachService.cs",
        "backend/contexts/valuation/RealEstateEval.Valuation.Infrastructure/Services/ValuationReconciliationService.cs",
        "backend/contexts/valuation/RealEstateEval.Valuation.Infrastructure/Services/ValuationReportFieldBuilder.cs",
        "backend/contexts/valuation/RealEstateEval.Valuation.Infrastructure/Services/ValuationReportFieldInjectionService.cs",
    ];

    [Fact]
    public void No_new_infrastructure_service_exceeds_the_cap()
    {
        var offenders = InfrastructureServiceFiles()
            .Where(file => LineCount(file) > MaxLines)
            .Select(RepoPaths.Relative)
            .Except(FrozenOverCap, StringComparer.Ordinal)
            .ToList();

        Assert.True(
            offenders.Count == 0,
            $"Infrastructure services over {MaxLines} lines that are not in the frozen list. Move the "
            + "use case behind an Application port (see CaseStudy.Application/Services) or extract rules:\n  "
            + string.Join("\n  ", offenders));
    }

    [Fact]
    public void Frozen_list_only_names_files_still_over_the_cap()
    {
        var stale = FrozenOverCap
            .Where(relative =>
            {
                var file = RepoPaths.Combine(relative.Split('/'));
                return !File.Exists(file) || LineCount(file) <= MaxLines;
            })
            .ToList();

        Assert.True(
            stale.Count == 0,
            "Frozen entries that shrank below the cap or moved. Remove them so the ratchet only turns one way:\n  "
            + string.Join("\n  ", stale));
    }

    private static IEnumerable<string> InfrastructureServiceFiles() =>
        Directory
            .EnumerateDirectories(RepoPaths.Combine("backend", "contexts"))
            .SelectMany(context => Directory.EnumerateDirectories(context, "*.Infrastructure"))
            .Select(infrastructure => Path.Combine(infrastructure, "Services"))
            .SelectMany(RepoPaths.CSharpFiles);

    private static int LineCount(string file) => File.ReadAllLines(file).Length;
}
