using RealEstateEval.Domain;

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
    public void Temporary_report_number_uses_tq_date_and_display_digits()
    {
        var n = ValuationReportNumberRules.FormatTemporary("V-12", new DateOnly(2026, 8, 19));
        Assert.Equal("TQ202608190012", n);
    }

    [Fact]
    public void Reserved_report_number_uses_distribution_date_not_preview_day()
    {
        var n = ValuationReportNumberRules.FormatReserved("VR-12", new DateOnly(2026, 8, 1));
        Assert.Equal("TQ202608010012", n);
    }

    [Fact]
    public void Issued_report_number_matches_preliminary_tq_format()
    {
        var n = ValuationReportNumberRules.FormatIssued(new DateOnly(2026, 8, 19), 1);
        Assert.Equal("TQ202608190001", n);
    }
}
