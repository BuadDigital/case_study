namespace RealEstateEval.Domain;

/// <summary>Geographic proximity helpers for comparable auto-suggest (system stream).</summary>
public static class ComparableProximityRules
{
    public const double EarthRadiusKm = 6371.0;
    public const decimal DefaultMaxDistanceKm = 5m;
    public const int DefaultTake = 15;

 /// <summary>Great-circle distance in kilometres (Haversine).</summary>
    public static decimal DistanceKm(
        decimal lat1,
        decimal lon1,
        decimal lat2,
        decimal lon2)
    {
        var φ1 = ToRadians((double)lat1);
        var φ2 = ToRadians((double)lat2);
        var Δφ = ToRadians((double)(lat2 - lat1));
        var Δλ = ToRadians((double)(lon2 - lon1));

        var a = Math.Sin(Δφ / 2) * Math.Sin(Δφ / 2)
            + Math.Cos(φ1) * Math.Cos(φ2) * Math.Sin(Δλ / 2) * Math.Sin(Δλ / 2);
        var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
        return Math.Round((decimal)(EarthRadiusKm * c), 3, MidpointRounding.AwayFromZero);
    }

    public static bool HasUsableCoordinates(decimal latitude, decimal longitude) =>
        !(latitude == 0m && longitude == 0m)
        && latitude is >= -90m and <= 90m
        && longitude is >= -180m and <= 180m;

    public static IReadOnlyList<(T Item, decimal DistanceKm)> RankByDistance<T>(
        decimal subjectLat,
        decimal subjectLon,
        IEnumerable<(T Item, decimal Lat, decimal Lon)> candidates,
        decimal maxDistanceKm,
        int take)
    {
        var max = maxDistanceKm <= 0m ? DefaultMaxDistanceKm : maxDistanceKm;
        var limit = take is < 1 or > 100 ? DefaultTake : take;

        return candidates
            .Where(c => HasUsableCoordinates(c.Lat, c.Lon))
            .Select(c => (c.Item, DistanceKm: DistanceKm(subjectLat, subjectLon, c.Lat, c.Lon)))
            .Where(x => x.DistanceKm <= max)
            .OrderBy(x => x.DistanceKm)
            .Take(limit)
            .ToList();
    }

    private static double ToRadians(double degrees) => degrees * Math.PI / 180.0;
}
