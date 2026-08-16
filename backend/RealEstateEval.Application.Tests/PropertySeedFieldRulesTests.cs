using RealEstateEval.Domain;

namespace RealEstateEval.Application.Tests;

public class PropertySeedFieldRulesTests
{
    [Fact]
    public void CountStreets_counts_street_types_only()
    {
        Assert.Equal(
            2,
            PropertyBoundaryTypes.CountStreets(
                PropertyBoundaryTypes.Street,
                PropertyBoundaryTypes.Plot,
                PropertyBoundaryTypes.Street,
                PropertyBoundaryTypes.Rail));
    }

    [Fact]
    public void Finishing_labels_are_arabic()
    {
        Assert.Equal("فاخر", PropertyFinishingTypes.LabelAr(PropertyFinishingTypes.Luxury));
        Assert.Equal("خرساني", PropertyFinishingStructures.LabelAr(PropertyFinishingStructures.Concrete));
    }

    [Fact]
    public void Plan_and_block_catalog_codes_are_platform()
    {
        Assert.Equal(ValuationReportFieldSourceKind.Platform, ValuationReportFieldCatalog.Find("2040")!.SourceKind);
        Assert.Equal(ValuationReportFieldSourceKind.Platform, ValuationReportFieldCatalog.Find("2060")!.SourceKind);
    }
}
