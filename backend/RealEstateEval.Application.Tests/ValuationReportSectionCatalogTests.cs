using RealEstateEval.Domain;
using Xunit;

namespace RealEstateEval.Application.Tests;

public class ValuationReportSectionCatalogTests
{
    [Fact]
    public void Catalog_has_exactly_27_sections_in_order()
    {
        Assert.Equal(27, ValuationReportSectionCatalog.All.Count);
        Assert.Equal(Enumerable.Range(1, 27), ValuationReportSectionCatalog.All.Select(s => s.Number));
        Assert.Equal(
            ValuationReportSectionKeys.ValuerIdentity,
            ValuationReportSectionCatalog.All[0].Key);
        Assert.Equal(
            ValuationReportSectionKeys.Glossary,
            ValuationReportSectionCatalog.All[^1].Key);
    }

    [Fact]
    public void Land_without_market_drops_comparable_sections()
    {
        var visible = ValuationReportSectionCatalog.ResolveVisible(
            hasStructuresToValue: false,
            marketApproachUsed: false,
            costApproachUsed: false);
        Assert.DoesNotContain(visible, s => s.Key == ValuationReportSectionKeys.Comparables);
        Assert.DoesNotContain(visible, s => s.Key == ValuationReportSectionKeys.Adjustments);
        Assert.Contains(visible, s => s.Key == ValuationReportSectionKeys.FinalValue);
        Assert.Equal(
            "المرافق في منطقة العقار",
            ValuationReportSectionCatalog.DisplayTitleAr(
                ValuationReportSectionCatalog.All.First(s =>
                    s.Key == ValuationReportSectionKeys.AreaUtilities),
                hasStructuresToValue: false));
    }

    [Fact]
    public void Building_with_market_keeps_adjustments_and_renames_utilities()
    {
        var visible = ValuationReportSectionCatalog.ResolveVisible(
            hasStructuresToValue: true,
            marketApproachUsed: true,
            costApproachUsed: true);
        Assert.Contains(visible, s => s.Key == ValuationReportSectionKeys.Comparables);
        Assert.Contains(visible, s => s.Key == ValuationReportSectionKeys.Adjustments);
        Assert.Equal(
            "الخدمات والمرافق",
            ValuationReportSectionCatalog.DisplayTitleAr(
                ValuationReportSectionCatalog.All.First(s =>
                    s.Key == ValuationReportSectionKeys.AreaUtilities),
                hasStructuresToValue: true));
        Assert.Equal("حتى 12 صورة (6 بالصفحة)", ValuationReportSectionCatalog.PhotoBudgetHint(true));
    }

    [Fact]
    public void Display_money_and_date()
    {
        Assert.Equal("2026/08/16", ValuationReportDisplayRules.FormatGregorianDate(new DateOnly(2026, 8, 16)));
        Assert.Equal("1,234.50", ValuationReportDisplayRules.FormatMoney(1234.5m));
        Assert.Equal("المقيم", ValuationReportDisplayRules.ValuerWordPlain);
    }

    [Fact]
    public void Iso_date_string_formats_and_falls_back()
    {
        Assert.Equal("2026/08/16", ValuationReportDisplayRules.FormatIsoDateString("2026-08-16"));
        Assert.Equal("2026/08/16", ValuationReportDisplayRules.FormatIsoDateString("2026-08-16T10:00:00Z"));
        Assert.Equal("", ValuationReportDisplayRules.FormatIsoDateString("  "));
        Assert.Equal("n/a", ValuationReportDisplayRules.FormatIsoDateString("n/a"));
    }

    [Fact]
    public void Hijri_uses_um_al_qura_with_heh_suffix()
    {
        var text = ValuationReportDisplayRules.FormatHijriDate(new DateOnly(2026, 8, 16));
        Assert.EndsWith("هـ", text);
 // Um Al-Qura: 2026-08-16 falls in 1448.
        Assert.StartsWith("1448/", text);
    }

    [Fact]
    public void Report_validity_is_90_days_advisory()
    {
        var until = ValuationReportValidityRules.ValidUntil(new DateOnly(2026, 8, 16));
        Assert.Equal(new DateOnly(2026, 11, 14), until);
        Assert.Contains("90", ValuationReportValidityRules.NoteAr(new DateOnly(2026, 8, 16)));
    }
}
