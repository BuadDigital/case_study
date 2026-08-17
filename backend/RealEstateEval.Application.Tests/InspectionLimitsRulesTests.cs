using RealEstateEval.Domain;
using Xunit;

namespace RealEstateEval.Application.Tests;

public class InspectionLimitsRulesTests
{
    [Fact]
    public void Scope_is_mandatory_and_must_be_known()
    {
        Assert.Contains("inspectionScopeKey",
            InspectionLimitsRules.Validate("", null, []).Keys);
        Assert.Contains("inspectionScopeKey",
            InspectionLimitsRules.Validate("bogus", null, []).Keys);
        Assert.Empty(InspectionLimitsRules.Validate(InspectionScopeKeys.Full, null, []));
    }

    [Fact]
    public void Restriction_reason_required_when_limited_or_units_excluded()
    {
        Assert.Contains("inspectionRestrictionReason",
            InspectionLimitsRules.Validate(InspectionScopeKeys.ExternalOnly, "", []).Keys);
        Assert.Contains("inspectionRestrictionReason",
            InspectionLimitsRules.Validate(InspectionScopeKeys.Desktop, null, []).Keys);
        Assert.Contains("inspectionRestrictionReason",
            InspectionLimitsRules.Validate(
                InspectionScopeKeys.Full, null,
                [new UninspectedUnitEntry(2, "إشغال بمستأجرين")]).Keys);

        Assert.Empty(InspectionLimitsRules.Validate(
            InspectionScopeKeys.ExternalOnly, "منع دخول", []));
    }

    [Fact]
    public void Uninspected_units_need_positive_count_and_reason()
    {
        var errors = InspectionLimitsRules.Validate(
            InspectionScopeKeys.Full,
            "سبب",
            [new UninspectedUnitEntry(0, ""), new UninspectedUnitEntry(3, "تعذّر دخول")]);
        Assert.Contains("uninspectedUnits[0].count", errors.Keys);
        Assert.Contains("uninspectedUnits[0].reason", errors.Keys);
        Assert.DoesNotContain("uninspectedUnits[1].count", errors.Keys);
    }

    [Fact]
    public void Reservation_text_is_empty_for_full_unrestricted_inspection()
    {
        Assert.Equal("",
            InspectionLimitsRules.ComposeReservationTextAr(InspectionScopeKeys.Full, null, []));
    }

    [Fact]
    public void Reservation_text_composes_scope_units_and_reason()
    {
        var text = InspectionLimitsRules.ComposeReservationTextAr(
            InspectionScopeKeys.ExternalOnly,
            "منع دخول مبنى حكومي",
            [new UninspectedUnitEntry(2, "إشغال بمستأجرين")]);

        Assert.Contains("الفحص الخارجي", text);
        Assert.Contains("2", text);
        Assert.Contains("إشغال بمستأجرين", text);
        Assert.Contains("منع دخول مبنى حكومي", text);

        var desktop = InspectionLimitsRules.ComposeReservationTextAr(
            InspectionScopeKeys.Desktop, "وعورة الطريق", []);
        Assert.Contains("مكتبياً عن بُعد", desktop);
    }

    [Fact]
    public void Units_json_round_trips_and_tolerates_garbage()
    {
        var units = new[]
        {
            new UninspectedUnitEntry(2, "إشغال"),
            new UninspectedUnitEntry(1, "تعذّر دخول"),
        };
        var json = InspectionLimitsRules.SerializeUnits(units);
        var parsed = InspectionLimitsRules.ParseUnits(json);
        Assert.Equal(2, parsed.Count);
        Assert.Equal(3, InspectionLimitsRules.TotalUninspectedUnits(parsed));

        Assert.Null(InspectionLimitsRules.SerializeUnits([]));
        Assert.Empty(InspectionLimitsRules.ParseUnits(null));
        Assert.Empty(InspectionLimitsRules.ParseUnits("not-json"));
    }
}
