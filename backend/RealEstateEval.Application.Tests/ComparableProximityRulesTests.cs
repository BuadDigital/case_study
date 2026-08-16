using RealEstateEval.Domain;
using Xunit;

namespace RealEstateEval.Application.Tests;

public class ComparableProximityRulesTests
{
    [Fact]
    public void DistanceKm_same_point_is_zero()
    {
        Assert.Equal(0m, ComparableProximityRules.DistanceKm(21.5m, 39.2m, 21.5m, 39.2m));
    }

    [Fact]
    public void DistanceKm_known_short_span()
    {
 // ~1.11 km north from equator at lon 0 (approx 0.01°)
        var d = ComparableProximityRules.DistanceKm(0m, 0m, 0.01m, 0m);
        Assert.InRange(d, 1.0m, 1.3m);
    }

    [Fact]
    public void RankByDistance_orders_and_filters()
    {
        var ranked = ComparableProximityRules.RankByDistance(
            21.5m,
            39.2m,
            [
                ("near", 21.501m, 39.2m),
                ("far", 22.5m, 39.2m),
                ("mid", 21.52m, 39.2m),
            ],
            maxDistanceKm: 5m,
            take: 10);

        Assert.Equal(2, ranked.Count);
        Assert.Equal("near", ranked[0].Item);
        Assert.Equal("mid", ranked[1].Item);
        Assert.True(ranked[0].DistanceKm < ranked[1].DistanceKm);
    }

    [Fact]
    public void Rejects_placeholder_zero_coords()
    {
        Assert.False(ComparableProximityRules.HasUsableCoordinates(0m, 0m));
        Assert.True(ComparableProximityRules.HasUsableCoordinates(21.5m, 39.2m));
    }
}
