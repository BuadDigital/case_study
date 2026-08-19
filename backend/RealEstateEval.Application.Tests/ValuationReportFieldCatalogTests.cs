using RealEstateEval.Domain;

namespace RealEstateEval.Application.Tests;

public class ValuationReportFieldCatalogTests
{
    [Fact]
    public void Catalog_fields_have_key_label_and_value_type()
    {
        Assert.Equal(247, ValuationReportFieldCatalog.Count);
        Assert.All(ValuationReportFieldCatalog.All, m =>
        {
            Assert.False(string.IsNullOrWhiteSpace(m.FieldKey));
            Assert.False(string.IsNullOrWhiteSpace(m.LabelAr));
        });
        Assert.Equal(
            ValuationReportFieldCatalog.Count,
            ValuationReportFieldCatalog.All.Select(m => m.FieldKey).Distinct(StringComparer.Ordinal).Count());
    }

    [Fact]
    public void Comparable_slots_map_to_bank_field_keys()
    {
        Assert.Equal("نوع العقار المقارن به 1 - عروض بيع لأراضي مماثلة", ValuationReportFieldCatalog.Find("comp1.property_type")!.LabelAr);
        Assert.Equal(ValuationReportFieldValueType.Number, ValuationReportFieldCatalog.Find("comp2.area_sqm")!.ValueType);
        Assert.Equal(ValuationReportFieldValueType.Money, ValuationReportFieldCatalog.Find("comp3.price_per_sqm")!.ValueType);
    }

    [Fact]
    public void Boundaries_come_from_deed_dump_keys()
    {
        var m = ValuationReportFieldCatalog.Find("north_boundary");
        Assert.NotNull(m);
        Assert.Equal(ValuationReportFieldSourceKind.Platform, m!.SourceKind);
        Assert.Equal(ValuationReportFieldValueType.Text, m.ValueType);
    }

    [Fact]
    public void Liquidation_discount_is_platform_stored_not_forced_apply()
    {
        var m = ValuationReportFieldCatalog.Find("final.liquidation_discount_pct");
        Assert.NotNull(m);
        Assert.Equal(ValuationReportFieldSourceKind.Platform, m!.SourceKind);
        Assert.Equal(ValuationReportFieldValueType.Percent, m.ValueType);
    }

    [Fact]
    public void Client_and_inspection_fields_are_platform_after_registry_parity()
    {
        var ar = ValuationReportFieldCatalog.Find("client_requesting_entity");
        Assert.NotNull(ar);
        Assert.Equal(ValuationReportFieldSourceKind.Platform, ar!.SourceKind);
        Assert.Equal(ValuationReportFieldValueType.Text, ar.ValueType);

        var en = ValuationReportFieldCatalog.Find("client_requesting_entity_en");
        Assert.NotNull(en);
        Assert.Equal(ValuationReportFieldSourceKind.Platform, en!.SourceKind);

        var inspection = ValuationReportFieldCatalog.Find("inspection_date");
        Assert.NotNull(inspection);
        Assert.Equal("inspection_date", inspection!.FieldKey);
        Assert.Equal(ValuationReportFieldSourceKind.Platform, inspection.SourceKind);
        Assert.Equal(ValuationReportFieldValueType.Date, inspection.ValueType);
    }

    [Fact]
    public void Usage_type_is_platform_from_property_classification()
    {
        var m = ValuationReportFieldCatalog.Find("usage_type_ar");
        Assert.NotNull(m);
        Assert.Equal(ValuationReportFieldSourceKind.Platform, m!.SourceKind);
        Assert.Equal(ValuationReportFieldValueType.Text, m.ValueType);
    }

    [Fact]
    public void Source_kind_and_value_type_api_labels_are_stable()
    {
        Assert.Equal("platform", ValuationReportFieldRules.SourceKindApi(ValuationReportFieldSourceKind.Platform));
        Assert.Equal("computed", ValuationReportFieldRules.SourceKindApi(ValuationReportFieldSourceKind.Computed));
        Assert.Equal("deferred", ValuationReportFieldRules.SourceKindApi(ValuationReportFieldSourceKind.Deferred));
        Assert.Equal("date", ValuationReportFieldRules.ValueTypeApi(ValuationReportFieldValueType.Date));
        Assert.Equal("تاريخ", ValuationReportFieldRules.ValueTypeLabelAr(ValuationReportFieldValueType.Date));
        Assert.True(ValuationReportFieldRules.IsResolvableNow(ValuationReportFieldSourceKind.Platform));
        Assert.False(ValuationReportFieldRules.IsResolvableNow(ValuationReportFieldSourceKind.Deferred));
    }
}
