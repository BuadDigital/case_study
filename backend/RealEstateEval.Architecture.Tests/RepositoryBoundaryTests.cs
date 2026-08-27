using RealEstateEval.Architecture.Tests.Support;

namespace RealEstateEval.Architecture.Tests;

/// <summary>
/// B7: Case Study CRUD pilots talk to an <c>IXxxRepository</c>; only the Infrastructure
/// adapter may open EF.
/// </summary>
public class RepositoryBoundaryTests
{
    public static TheoryData<string, string> Pilots => new()
    {
        { "Client", "IClientRepository" },
        { "PoIntakeDraft", "IPoIntakeDraftRepository" },
    };

    [Theory]
    [MemberData(nameof(Pilots))]
    public void Use_case_does_not_open_the_DbContext(string aggregate, string repository)
    {
        var file = CaseStudyApplication("Services", $"{aggregate}Service.cs");
        Assert.True(File.Exists(file), $"{aggregate}Service must live in CaseStudy.Application.");

        var text = File.ReadAllText(file);
        Assert.DoesNotContain("CaseStudyDbContext", text, StringComparison.Ordinal);
        Assert.DoesNotContain("EntityFrameworkCore", text, StringComparison.Ordinal);
        Assert.Contains(repository, text, StringComparison.Ordinal);
    }

    [Theory]
    [MemberData(nameof(Pilots))]
    public void Repository_contract_has_no_EF_types(string aggregate, string repository)
    {
        var file = CaseStudyApplication("Abstractions", $"{repository}.cs");
        Assert.True(File.Exists(file), $"{aggregate} persistence is {repository}.");

        var text = File.ReadAllText(file);
        Assert.DoesNotContain("EntityFrameworkCore", text, StringComparison.Ordinal);
        Assert.DoesNotContain("DbContext", text, StringComparison.Ordinal);
    }

    [Theory]
    [MemberData(nameof(Pilots))]
    public void Ef_adapter_implements_the_repository(string aggregate, string repository)
    {
        var file = RepoPaths.Combine(
            "backend",
            "contexts",
            "case-study",
            "RealEstateEval.CaseStudy.Infrastructure",
            "Persistence",
            $"{aggregate}Repository.cs");
        Assert.True(File.Exists(file), $"{aggregate}Repository is the EF adapter.");

        var text = File.ReadAllText(file);
        Assert.Contains(repository, text, StringComparison.Ordinal);
        Assert.Contains("CaseStudyDbContext", text, StringComparison.Ordinal);
    }

    [Fact]
    public void Case_study_services_do_not_take_the_DbContext()
    {
        var files = RepoPaths.CSharpFiles(RepoPaths.Combine(
                "backend",
                "contexts",
                "case-study",
                "RealEstateEval.CaseStudy.Infrastructure",
                "Services"))
            .Concat(RepoPaths.CSharpFiles(RepoPaths.Combine(
                "backend",
                "contexts",
                "case-study",
                "RealEstateEval.CaseStudy.Infrastructure",
                "Integration")))
            .Concat(RepoPaths.CSharpFiles(RepoPaths.Combine(
                "backend",
                "contexts",
                "financial",
                "RealEstateEval.Financial.Infrastructure",
                "Services")))
            .Concat(RepoPaths.CSharpFiles(RepoPaths.Combine(
                "backend",
                "contexts",
                "operations",
                "RealEstateEval.Operations.Infrastructure",
                "Services")))
            .Concat(new[]
            {
                RepoPaths.Combine("backend", "RealEstateEval.Infrastructure", "Services", "CaseStudyLookup.cs"),
                RepoPaths.Combine("backend", "RealEstateEval.Infrastructure", "Services", "CaseStudyCommands.cs"),
                RepoPaths.Combine(
                    "backend",
                    "RealEstateEval.Infrastructure",
                    "Services",
                    "CaseStudyPropertyPoNumberLookup.cs"),
                RepoPaths.Combine(
                    "backend",
                    "RealEstateEval.Infrastructure",
                    "Services",
                    "WorkflowAssigneeLookup.cs"),
            });

        var violations = files
            .Where(File.Exists)
            .Where(file => File.ReadAllText(file).Contains("CaseStudyDbContext", StringComparison.Ordinal))
            .Select(RepoPaths.Relative)
            .ToList();

        Assert.True(
            violations.Count == 0,
            "Case Study, Financial, and Operations use-cases must not take CaseStudyDbContext:\n  "
            + string.Join("\n  ", violations));
    }

    [Fact]
    public void CaseStudyDbContext_implements_the_session()
    {
        // A8 physical move: the context lives in its context library.
        var file = RepoPaths.Combine(
            "backend",
            "contexts",
            "case-study",
            "RealEstateEval.CaseStudy.Infrastructure",
            "Data",
            "CaseStudyDbContext.cs");
        Assert.Contains("ICaseStudyRepository", File.ReadAllText(file), StringComparison.Ordinal);
    }

    private static string CaseStudyApplication(params string[] parts) =>
        RepoPaths.Combine(
            ["backend", "contexts", "case-study", "RealEstateEval.CaseStudy.Application", .. parts]);
}
