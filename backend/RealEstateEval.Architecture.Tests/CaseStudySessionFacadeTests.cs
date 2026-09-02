using System.Text.RegularExpressions;
using RealEstateEval.Architecture.Tests.Support;

namespace RealEstateEval.Architecture.Tests;

/// <summary>
/// docs/architecture/solid-scorecard.md finding 2: <c>ICaseStudyRepository</c> is a DbSet facade
/// with a repository name. Retiring it is incremental, so this ratchet freezes today's consumers
/// (nothing new may take the facade) and forbids EF query types on any Application abstraction.
/// </summary>
public class CaseStudySessionFacadeTests
{
    /// <summary>Snapshot 2026-09-02. Shrink only: move a consumer behind an Application port and delete its line.</summary>
    private static readonly string[] FrozenFacadeConsumers =
    [
        "backend/contexts/case-study/RealEstateEval.CaseStudy.Infrastructure/Integration/ValuationReportWorkflowHandler.cs",
        "backend/contexts/case-study/RealEstateEval.CaseStudy.Infrastructure/Services/BuildingInventoryService.cs",
        "backend/contexts/case-study/RealEstateEval.CaseStudy.Infrastructure/Services/CaseStudyCommands.cs",
        "backend/contexts/case-study/RealEstateEval.CaseStudy.Infrastructure/Services/CaseStudyFormService.cs",
        "backend/contexts/case-study/RealEstateEval.CaseStudy.Infrastructure/Services/CaseStudyLookup.cs",
        "backend/contexts/case-study/RealEstateEval.CaseStudy.Infrastructure/Services/CaseStudyPropertyPoNumberLookup.cs",
        "backend/contexts/case-study/RealEstateEval.CaseStudy.Infrastructure/Services/CaseStudyValuationDispatchService.cs",
        "backend/contexts/case-study/RealEstateEval.CaseStudy.Infrastructure/Services/DashboardOpsMetricsQueryService.cs",
        "backend/contexts/case-study/RealEstateEval.CaseStudy.Infrastructure/Services/FieldInspectionWorkspaceService.cs",
        "backend/contexts/case-study/RealEstateEval.CaseStudy.Infrastructure/Services/InspectionLimitsService.cs",
        "backend/contexts/case-study/RealEstateEval.CaseStudy.Infrastructure/Services/NumberedDocumentService.cs",
        "backend/contexts/case-study/RealEstateEval.CaseStudy.Infrastructure/Services/PropertyGroupService.cs",
        "backend/contexts/case-study/RealEstateEval.CaseStudy.Infrastructure/Services/PropertyTimelineService.cs",
        "backend/contexts/case-study/RealEstateEval.CaseStudy.Infrastructure/Services/TransactionStateService.cs",
        "backend/contexts/case-study/RealEstateEval.CaseStudy.Infrastructure/Services/WorkOrderLoader.cs",
        "backend/contexts/case-study/RealEstateEval.CaseStudy.Infrastructure/Services/WorkOrderPropertyCommands.cs",
        "backend/contexts/case-study/RealEstateEval.CaseStudy.Infrastructure/Services/WorkOrderQueryService.cs",
        "backend/contexts/case-study/RealEstateEval.CaseStudy.Infrastructure/Services/WorkOrderService.cs",
        "backend/contexts/case-study/RealEstateEval.CaseStudy.Infrastructure/Services/WorkOrderVisibilityFilter.cs",
        "backend/contexts/case-study/RealEstateEval.CaseStudy.Infrastructure/Services/WorkflowAssigneeLookup.cs",
        "backend/contexts/case-study/RealEstateEval.CaseStudy.Infrastructure/Services/WorkflowTaskCascadeCleanup.cs",
        "backend/contexts/case-study/RealEstateEval.CaseStudy.Infrastructure/Services/WorkflowTaskDistributionCommands.cs",
        "backend/contexts/case-study/RealEstateEval.CaseStudy.Infrastructure/Services/WorkflowTaskLifecycleCommands.cs",
        "backend/contexts/case-study/RealEstateEval.CaseStudy.Infrastructure/Services/WorkflowTaskQueryService.cs",
        "backend/contexts/case-study/RealEstateEval.CaseStudy.Infrastructure/Services/WorkflowTaskShellPatcher.cs",
        "backend/contexts/case-study/RealEstateEval.CaseStudy.Infrastructure/Services/WorkflowTaskSlotSynchronizer.cs",
    ];

    /// <summary>Plumbing that legitimately names the facade: its definition, the context, DI, and shared helpers.</summary>
    private static readonly string[] FacadePlumbing =
    [
        "backend/RealEstateEval.Infrastructure/Data/Contexts/CaseStudy/ICaseStudyRepository.cs",
        "backend/RealEstateEval.Infrastructure/Data/DbContextTransaction.cs",
        "backend/RealEstateEval.Infrastructure/Data/ReferenceSequenceAllocator.cs",
        "backend/contexts/case-study/RealEstateEval.CaseStudy.Infrastructure/CaseStudyDependencyInjection.cs",
        "backend/contexts/case-study/RealEstateEval.CaseStudy.Infrastructure/Data/CaseStudyDbContext.cs",
    ];

    [Fact]
    public void No_new_consumer_takes_the_session_facade()
    {
        var consumers = ProductionSourceFiles()
            .Where(file => File.ReadAllText(file).Contains("ICaseStudyRepository", StringComparison.Ordinal))
            .Select(RepoPaths.Relative)
            .Except(FacadePlumbing, StringComparer.Ordinal)
            .ToList();

        var added = consumers.Except(FrozenFacadeConsumers, StringComparer.Ordinal).ToList();
        Assert.True(
            added.Count == 0,
            "New consumers of ICaseStudyRepository. Depend on a per-aggregate port in "
            + "CaseStudy.Application/Abstractions (see IPartyTaskSubmissionRepository) instead:\n  "
            + string.Join("\n  ", added));
    }

    [Fact]
    public void Frozen_consumer_list_only_names_files_that_still_take_the_facade()
    {
        var stale = FrozenFacadeConsumers
            .Where(relative =>
            {
                var file = RepoPaths.Combine(relative.Split('/'));
                return !File.Exists(file)
                    || !File.ReadAllText(file).Contains("ICaseStudyRepository", StringComparison.Ordinal);
            })
            .ToList();

        Assert.True(
            stale.Count == 0,
            "Frozen entries no longer take the facade. Remove them so the ratchet only turns one way:\n  "
            + string.Join("\n  ", stale));
    }

    /// <summary>
    /// Application contracts describe intent, not queries: no <c>IQueryable</c>, <c>DbSet</c>, or
    /// EF namespace may appear on an Application abstraction in any context or the shared assembly.
    /// </summary>
    [Fact]
    public void Application_abstractions_do_not_expose_query_types()
    {
        var forbidden = new Regex(@"\b(IQueryable|DbSet|EntityFrameworkCore)\b", RegexOptions.Compiled);

        var abstractionRoots = Directory
            .EnumerateDirectories(RepoPaths.Combine("backend", "contexts"))
            .SelectMany(context => Directory.EnumerateDirectories(context, "*.Application"))
            .Append(RepoPaths.Combine("backend", "RealEstateEval.Application"))
            .Select(application => Path.Combine(application, "Abstractions"));

        var violations = abstractionRoots
            .SelectMany(RepoPaths.CSharpFiles)
            .Where(file => forbidden.IsMatch(File.ReadAllText(file)))
            .Select(RepoPaths.Relative)
            .ToList();

        Assert.True(
            violations.Count == 0,
            "Application abstractions expose EF query types. Return materialised lists, predicates "
            + "(Expression<Func<T, bool>>), or facts records instead:\n  "
            + string.Join("\n  ", violations));
    }

    private static IEnumerable<string> ProductionSourceFiles() =>
        new[]
            {
                RepoPaths.Combine("backend", "contexts"),
                RepoPaths.Combine("backend", "RealEstateEval.Infrastructure"),
                RepoPaths.Combine("backend", "RealEstateEval.Application"),
                RepoPaths.Combine("backend", "services"),
                RepoPaths.Combine("backend", "shared"),
            }
            .SelectMany(RepoPaths.CSharpFiles);
}
