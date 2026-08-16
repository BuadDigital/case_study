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
    public void Temporary_report_number_includes_year_and_display_id()
    {
        var n = ValuationReportNumberRules.FormatTemporary("V-12", new DateOnly(2026, 8, 16));
        Assert.Equal("تق-2026-V-12", n);
    }
}
