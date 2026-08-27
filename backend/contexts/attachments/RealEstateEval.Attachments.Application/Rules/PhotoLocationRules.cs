namespace RealEstateEval.Attachments.Application.Rules;

/// <summary>
/// Photo vs property location flags. Never blocks upload.
/// </summary>
public static class PhotoLocationRules
{
    public const double MaxMatchDistanceMeters = 500;

    public const string FlagMatch = "match";
    public const string FlagOutsideProperty = "outside_property";
    public const string FlagLocationUnavailable = "location_unavailable";

    public static (double? DistanceM, string? Flag) Evaluate(
        double? photoLatitude,
        double? photoLongitude,
        double? propertyLatitude,
        double? propertyLongitude)
    {
        if (photoLatitude is null || photoLongitude is null)
            return (null, FlagLocationUnavailable);

        if (propertyLatitude is null || propertyLongitude is null)
            return (null, null);

        var distance = HaversineMeters(
            photoLatitude.Value,
            photoLongitude.Value,
            propertyLatitude.Value,
            propertyLongitude.Value);

        var flag = distance > MaxMatchDistanceMeters
            ? FlagOutsideProperty
            : FlagMatch;

        return (Math.Round(distance, 1), flag);
    }

    public static double HaversineMeters(
        double lat1,
        double lon1,
        double lat2,
        double lon2)
    {
        const double earthRadiusM = 6_371_000;
        var dLat = DegreesToRadians(lat2 - lat1);
        var dLon = DegreesToRadians(lon2 - lon1);
        var a =
            Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
            Math.Cos(DegreesToRadians(lat1)) *
            Math.Cos(DegreesToRadians(lat2)) *
            Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
        return earthRadiusM * c;
    }

    private static double DegreesToRadians(double degrees) => degrees * Math.PI / 180;
}
