using RealEstateEval.Application.Contracts;
using RealEstateEval.Infrastructure.Services;
using RealEstateEval.Platform.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

/// <summary>
/// Decision 23 (amended by Q-15): one version for the entire text package — any change, even to one paragraph, issues
/// a complete new package; work in progress adopts the latest; issued reports are frozen (Q-6 snapshot).
/// </summary>
public class ReportTextPackageVersionTests
{
    [Fact]
    public async Task Shipped_defaults_read_as_package_version_one_without_writes()
    {
        await using var contexts = TestDatabases.Create("text-package-fresh");
        var service = new OrganizationSettingsService(contexts.Platform, new AuditLogWriter());

        var dto = await service.GetInternalAsync();
        Assert.Equal(1, dto.ValuationReport.TextPackageVersion);
        Assert.Empty(contexts.Platform.ValuationReportTextPackages);
    }

    [Fact]
    public async Task Editing_any_paragraph_issues_a_whole_new_package()
    {
        await using var contexts = TestDatabases.Create("text-package-edit");
        var service = new OrganizationSettingsService(contexts.Platform, new AuditLogWriter());

        // Save does not touch the block: Seed Package records only copy 1.
        await service.SaveAsync(new SaveOrganizationSettingsRequest(), "cdo-1");
        Assert.Equal(1, contexts.Platform.ValuationReportTextPackages.Count());
        var afterNoop = await service.GetInternalAsync();
        Assert.Equal(1, afterNoop.ValuationReport.TextPackageVersion);

        // Modify one paragraph (independence) — the whole package releases version 2.
        var current = await service.GetInternalAsync();
        var edited = await service.SaveAsync(
            new SaveOrganizationSettingsRequest
            {
                ValuationReport = Clone(current.ValuationReport, independence:
                    "نص استقلالية معدَّل بقرار إدارة المنشأة — صياغة جديدة."),
            },
            "cdo-1");
        Assert.Equal(2, edited.ValuationReport.TextPackageVersion);
        Assert.Equal(2, contexts.Platform.ValuationReportTextPackages.Count());
        Assert.Equal(
            "cdo-1",
            contexts.Platform.ValuationReportTextPackages
                .Single(p => p.Version == 2).CreatedByUserId);

        // Save verbatim — no new copy.
        var repeat = await service.SaveAsync(
            new SaveOrganizationSettingsRequest
            {
                ValuationReport = Clone(edited.ValuationReport),
            },
            "cdo-1");
        Assert.Equal(2, repeat.ValuationReport.TextPackageVersion);
        Assert.Equal(2, contexts.Platform.ValuationReportTextPackages.Count());

        // Edit another paragraph — Version 3: The number labels the package, not the paragraph.
        var third = await service.SaveAsync(
            new SaveOrganizationSettingsRequest
            {
                ValuationReport = Clone(repeat.ValuationReport, glossary:
                    "مسرد محدَّث وفق قائمة IVS المعتمدة الجديدة."),
            },
            "cdo-2");
        Assert.Equal(3, third.ValuationReport.TextPackageVersion);
        Assert.Equal(3, contexts.Platform.ValuationReportTextPackages.Count());
    }

 // Editable version of the text block — other fields are transferred as is.
    private static OrganizationValuationReportSettingsDto Clone(
        OrganizationValuationReportSettingsDto source,
        string? independence = null,
        string? glossary = null) => new()
        {
            ReportType = source.ReportType,
            Currency = source.Currency,
            ValuationBranch = source.ValuationBranch,
            KeyInputsText = source.KeyInputsText,
            ProfessionalStandards = source.ProfessionalStandards,
            Independence = independence ?? source.Independence,
            ResearchScopeText = source.ResearchScopeText,
            Terms = source.Terms,
            Restrictions = source.Restrictions,
            IvsStandards = source.IvsStandards,
            Glossary = glossary ?? source.Glossary,
            FinishingLuxury = source.FinishingLuxury,
            FinishingMedium = source.FinishingMedium,
        };
}
