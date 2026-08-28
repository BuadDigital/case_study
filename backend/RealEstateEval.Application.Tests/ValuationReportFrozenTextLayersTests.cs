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
 // ورشة الترقيم (بند البتّ 3): النمط الموحد TQ-{سنة}-{تسلسل ٥}.
    public void Temporary_report_number_uses_tq_year_and_display_digits()
    {
        var n = ValuationReportNumberRules.FormatTemporary("V-12", new DateOnly(2026, 8, 19));
        Assert.Equal("TQ-2026-00012", n);
    }

    [Fact]
    public void Reserved_report_number_uses_distribution_year_not_preview_day()
    {
        var n = ValuationReportNumberRules.FormatReserved("VR-12", new DateOnly(2026, 8, 1));
        Assert.Equal("TQ-2026-00012", n);
    }

    [Fact]
    public void Issued_report_number_matches_workshop_tq_format()
    {
        var n = ValuationReportNumberRules.FormatIssued(new DateOnly(2026, 8, 19), 1);
        Assert.Equal("TQ-2026-00001", n);
    }
}
