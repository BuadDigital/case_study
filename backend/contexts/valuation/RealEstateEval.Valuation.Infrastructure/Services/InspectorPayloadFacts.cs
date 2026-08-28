namespace RealEstateEval.Valuation.Infrastructure.Services;

/// <summary>
/// Facts extracted from the field inspector's submission payload (single source,
/// ). Loose JSON parse — absent keys stay null («لا تُخترع بيانات»).
/// </summary>
public sealed class InspectorPayloadFacts
{
    public string? BuildState { get; init; }
    public string? OccupancyState { get; init; }
    public string? Movables { get; init; }
    public string? MovablesDescription { get; init; }
    public string? PropertyAgeYears { get; init; }
    public string? PropertyDescription { get; init; }
    public string? RoomCount { get; init; }
    public string? HallCount { get; init; }
    public string? BathroomCount { get; init; }
    public string? AnnexTotal { get; init; }
    public string? BasementTotal { get; init; }
    public string? HasAnnex { get; init; }
    public string? HasElevator { get; init; }
    public string? HasPool { get; init; }
    public string? Kitchen { get; init; }
    public string? JacuzziCount { get; init; }
    public string? DiningCount { get; init; }
    public string? MajlisCount { get; init; }
    public string? MaidRoomCount { get; init; }
    public string? GuardRoomCount { get; init; }
    public string? ParkingCount { get; init; }
    public string? StoreCount { get; init; }
    public string? PlaygroundCount { get; init; }
    public string? UnitCount { get; init; }
    public string? ShowroomCount { get; init; }
    public string? WellCount { get; init; }
    public string? TowerCount { get; init; }
    public string? AnnexUpperCount { get; init; }
    public string? AnnexGroundCount { get; init; }
    public string? OtherComponents { get; init; }
    public string? ElectricityMeterCount { get; init; }
    public string? ElectricityMeterNumbers { get; init; }
    public string? WaterMeterCount { get; init; }
    public string? WaterMeterNumbers { get; init; }
    public string? HasViolations { get; init; }
    public string? ViolationsDescription { get; init; }
    public string? MapLatitude { get; init; }
    public string? MapLongitude { get; init; }
    public IReadOnlyList<string> Services { get; init; } = [];
    public IReadOnlyList<string> Amenities { get; init; } = [];
    public string? Observations { get; init; }

    public static InspectorPayloadFacts Parse(string? payloadJson)
    {
        if (string.IsNullOrWhiteSpace(payloadJson)) return new InspectorPayloadFacts();
        try
        {
            using var doc = System.Text.Json.JsonDocument.Parse(payloadJson);
            var root = doc.RootElement;
            if (root.ValueKind != System.Text.Json.JsonValueKind.Object)
                return new InspectorPayloadFacts();

            string? Feature(string key)
            {
                if (root.TryGetProperty("featureValues", out var features)
                    && features.ValueKind == System.Text.Json.JsonValueKind.Object
                    && features.TryGetProperty(key, out var v)
                    && v.ValueKind == System.Text.Json.JsonValueKind.String)
                {
                    var s = v.GetString();
                    return string.IsNullOrWhiteSpace(s) ? null : s.Trim();
                }

                return null;
            }

            string? Scalar(string key)
            {
                if (!root.TryGetProperty(key, out var v)) return null;
                var s = v.ValueKind switch
                {
                    System.Text.Json.JsonValueKind.String => v.GetString(),
                    System.Text.Json.JsonValueKind.Number => v.GetRawText(),
                    _ => null,
                };
                return string.IsNullOrWhiteSpace(s) ? null : s.Trim();
            }

            static IReadOnlyList<string> StringArray(System.Text.Json.JsonElement root, string key)
            {
                var list = new List<string>();
                if (!root.TryGetProperty(key, out var arr) || arr.ValueKind != System.Text.Json.JsonValueKind.Array)
                    return list;
                foreach (var item in arr.EnumerateArray())
                {
                    if (item.ValueKind == System.Text.Json.JsonValueKind.String
                        && !string.IsNullOrWhiteSpace(item.GetString()))
                    {
                        list.Add(item.GetString()!.Trim());
                    }
                }
                return list;
            }

            var observationBits = new List<string>();
            if (root.TryGetProperty("observations", out var obs)
                && obs.ValueKind == System.Text.Json.JsonValueKind.Array)
            {
                foreach (var item in obs.EnumerateArray())
                {
                    if (item.ValueKind != System.Text.Json.JsonValueKind.Object) continue;
                    var cat = item.TryGetProperty("category", out var c) ? c.GetString()?.Trim() : null;
                    var text = item.TryGetProperty("text", out var t) ? t.GetString()?.Trim() : null;
                    if (string.IsNullOrWhiteSpace(cat) && string.IsNullOrWhiteSpace(text)) continue;
                    observationBits.Add(
                        !string.IsNullOrWhiteSpace(cat) && !string.IsNullOrWhiteSpace(text)
                            ? $"{cat}: {text}"
                            : cat ?? text ?? "");
                }
            }

            return new InspectorPayloadFacts
            {
                BuildState = Feature("buildState"),
                OccupancyState = Feature("occupancyState"),
                Movables = Feature("movables"),
                MovablesDescription = Feature("movablesDescription"),
                PropertyAgeYears = Scalar("propertyAgeYears"),
                PropertyDescription = Scalar("propertyDescription"),
                RoomCount = Scalar("roomCount"),
                HallCount = Scalar("hallCount"),
                BathroomCount = Scalar("bathroomCount"),
                AnnexTotal = Scalar("annexTotal"),
                BasementTotal = Scalar("basementTotal"),
                HasAnnex = Scalar("hasAnnex"),
                HasElevator = Feature("hasElevator"),
                HasPool = Feature("hasPool"),
                Kitchen = Feature("kitchen"),
                JacuzziCount = Scalar("jacuzziCount"),
                DiningCount = Scalar("diningCount"),
                MajlisCount = Scalar("majlisCount"),
                MaidRoomCount = Scalar("maidRoomCount"),
                GuardRoomCount = Scalar("guardRoomCount"),
                ParkingCount = Scalar("parkingCount"),
                StoreCount = Scalar("storeCount"),
                PlaygroundCount = Scalar("playgroundCount"),
                UnitCount = Scalar("unitCount"),
                ShowroomCount = Scalar("showroomCount"),
                WellCount = Scalar("wellCount"),
                TowerCount = Scalar("towerCount"),
                AnnexUpperCount = Scalar("annexUpperCount"),
                AnnexGroundCount = Scalar("annexGroundCount"),
                ElectricityMeterCount = Scalar("electricityMeterCount"),
                ElectricityMeterNumbers = Scalar("electricityMeterNumbers"),
                WaterMeterCount = Scalar("waterMeterCount"),
                WaterMeterNumbers = Scalar("waterMeterNumbers"),
                HasViolations = Scalar("hasViolations"),
                ViolationsDescription = Scalar("violationsDescription"),
                MapLatitude = Scalar("mapLatitude"),
                MapLongitude = Scalar("mapLongitude"),
                Services = StringArray(root, "services"),
                Amenities = StringArray(root, "amenities"),
                Observations = observationBits.Count == 0 ? null : string.Join("؛ ", observationBits),
            };
        }
        catch (System.Text.Json.JsonException)
        {
            return new InspectorPayloadFacts();
        }
    }
}
