using RealEstateEval.Domain;

namespace RealEstateEval.Application.Tests;

public class ValuationReportFieldCatalogTests
{
    [Fact]
    public void Catalog_has_247_codes_from_package_analysis()
    {
        Assert.Equal(247, ValuationReportFieldCatalog.Count);
        Assert.All(ValuationReportFieldCatalog.All, m =>
        {
            Assert.False(string.IsNullOrWhiteSpace(m.Code));
            Assert.False(string.IsNullOrWhiteSpace(m.FieldKey));
            Assert.False(string.IsNullOrWhiteSpace(m.LabelAr));
        });
    }

    [Fact]
    public void Comparable_slots_map_to_bank_field_keys()
    {
        Assert.Equal("comp1.property_type", ValuationReportFieldCatalog.Find("60011")!.FieldKey);
        Assert.Equal("comp2.area_sqm", ValuationReportFieldCatalog.Find("20250")!.FieldKey);
        Assert.Equal("comp3.price_per_sqm", ValuationReportFieldCatalog.Find("20300")!.FieldKey);
    }

    [Fact]
    public void Boundaries_come_from_deed_dump_keys()
    {
        Assert.Equal("north_boundary", ValuationReportFieldCatalog.Find("2090")!.FieldKey);
        Assert.Equal(ValuationReportFieldSourceKind.Platform, ValuationReportFieldCatalog.Find("2090")!.SourceKind);
    }

    [Fact]
    public void Liquidation_discount_is_platform_stored_not_forced_apply()
    {
        var m = ValuationReportFieldCatalog.Find("30100");
        Assert.NotNull(m);
        Assert.Equal("final.liquidation_discount_pct", m!.FieldKey);
        Assert.Equal(ValuationReportFieldSourceKind.Platform, m.SourceKind);
    }

    [Fact]
    public void Client_and_inspection_codes_are_platform_after_registry_parity()
    {
        var ar = ValuationReportFieldCatalog.Find("1213");
        Assert.NotNull(ar);
        Assert.Equal("client_requesting_entity", ar!.FieldKey);
        Assert.Equal(ValuationReportFieldSourceKind.Platform, ar.SourceKind);

        var en = ValuationReportFieldCatalog.Find("1212");
        Assert.NotNull(en);
        Assert.Equal("client_requesting_entity_en", en!.FieldKey);
        Assert.Equal(ValuationReportFieldSourceKind.Platform, en.SourceKind);

        var inspection = ValuationReportFieldCatalog.Find("65111");
        Assert.NotNull(inspection);
        Assert.Equal("inspection_date", inspection!.FieldKey);
        Assert.Equal(ValuationReportFieldSourceKind.Platform, inspection.SourceKind);
    }

    [Fact]
    public void Usage_type_is_platform_from_property_classification()
    {
        var m = ValuationReportFieldCatalog.Find("3083");
        Assert.NotNull(m);
        Assert.Equal("usage_type_ar", m!.FieldKey);
        Assert.Equal(ValuationReportFieldSourceKind.Platform, m.SourceKind);
    }

    [Fact]
    public void Source_kind_api_labels_are_stable()
    {
        Assert.Equal("platform", ValuationReportFieldRules.SourceKindApi(ValuationReportFieldSourceKind.Platform));
        Assert.Equal("computed", ValuationReportFieldRules.SourceKindApi(ValuationReportFieldSourceKind.Computed));
        Assert.Equal("deferred", ValuationReportFieldRules.SourceKindApi(ValuationReportFieldSourceKind.Deferred));
        Assert.True(ValuationReportFieldRules.IsResolvableNow(ValuationReportFieldSourceKind.Platform));
        Assert.False(ValuationReportFieldRules.IsResolvableNow(ValuationReportFieldSourceKind.Deferred));
    }
}
