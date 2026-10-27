using RealEstateEval.Domain;
using RealEstateEval.Valuation.Domain;

namespace RealEstateEval.Application.Tests;

public class ValuationReportFrozenTextLayersTests
{
    [Fact]
    public void Frozen_sections_have_non_empty_bodies()
    {
        Assert.False(string.IsNullOrWhiteSpace(
            ValuationReportFrozenTextLayers.ForSectionKey(ValuationReportSectionKeys.ProfessionalStandards)));
        Assert.False(string.IsNullOrWhiteSpace(
            ValuationReportFrozenTextLayers.ForSectionKey(ValuationReportSectionKeys.Independence)));
        Assert.False(string.IsNullOrWhiteSpace(
            ValuationReportFrozenTextLayers.ForSectionKey(ValuationReportSectionKeys.Glossary)));
        Assert.StartsWith("ejadah-frozen-text-", ValuationReportFrozenTextLayers.VersionId);
    }

    [Fact]
    public void Settings_defaults_seed_official_copy_and_fill_empty_values()
    {
        Assert.Contains("IVSC", ValuationReportSettingsDefaults.ProfessionalStandards, StringComparison.Ordinal);
        Assert.Equal(
            ValuationReportSettingsDefaults.ProfessionalStandards,
            ValuationReportSettingsDefaults.ForSectionKey(ValuationReportSectionKeys.ProfessionalStandards));
        Assert.Equal(
            ValuationReportSettingsDefaults.ReportType,
            ValuationReportSettingsDefaults.Clip("", ValuationReportSettingsDefaults.ReportType, 200));
        Assert.Contains("فرع", ValuationReportSettingsDefaults.ValuationBranch, StringComparison.Ordinal);
    }

    [Fact]
    // The report numbers derive from the transaction's PR root.
    public void Report_numbers_derive_from_the_transaction_reference()
    {
        Assert.Equal("PRV-2026-00012", ReferenceNumbering.ValuationReportNumber("PR-2026-00012"));
        Assert.Equal("PRC-2026-00012", ReferenceNumbering.CaseStudyReportNumber(" PR-2026-00012 "));
        Assert.Null(ReferenceNumbering.ValuationReportNumber("TMP-26-00012"));
        // The printed form carries a two-digit year; the counters keep the full year.
        Assert.Equal("PR-26-00123", ReferenceNumbering.Format(ReferenceNumbering.Property, 2026, 123));
        Assert.Equal("TMP-26-00055", ReferenceNumbering.Format(ReferenceNumbering.TransactionDraft, 2026, 55));
        Assert.Equal("PRV-26-00123", ReferenceNumbering.ValuationReportNumber("PR-26-00123"));
        Assert.Null(ReferenceNumbering.ValuationReportNumber(null));
    }

    [Fact]
    public void Report_number_version_suffix_starts_at_two()
    {
        Assert.Equal("PRV-2026-00001", ReferenceNumbering.WithVersion("PRV-2026-00001", 1));
        Assert.Equal("PRV-2026-00001/2", ReferenceNumbering.WithVersion("PRV-2026-00001", 2));
    }
}
