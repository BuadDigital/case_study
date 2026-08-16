namespace RealEstateEval.Domain;

/// <summary>
/// Lite cost / inventory line for Word-merge template cells (no Application DTO dependency).
/// </summary>
public readonly record struct ValuationReportFieldCostLineLite(
    string StructureKind,
    string Label,
    decimal AreaSqm,
    decimal UnitCostSar,
    bool IsIncluded,
    string ItemKey = "");

/// <summary>
/// Maps priced cost-approach (or inventory area) lines into Word-merge cost_line.* / inventory.* keys.
/// Label heuristics disambiguate floor/annex slots; StructureKind is the primary gate.
/// </summary>
public static class ValuationReportFieldCostLineFlattenRules
{
    private enum Bucket
    {
        Apartment,
        Basement,
        GroundFloor,
        FirstFloor,
        RepeatedFloor,
        AnnexGround,
        AnnexUpper,
        Fence,
        Pool,
        Parking,
        Other,
    }

    public static void PutFromLines(
        IDictionary<string, string?> bag,
        IReadOnlyList<ValuationReportFieldCostLineLite> lines,
        bool hasStructuresToValue)
    {
        if (!hasStructuresToValue || lines.Count == 0) return;

 // Aggregate per bucket — several repeated floors (or fences, pools…) must sum,
 // not overwrite each other, so 7180/7190/7200 carry the whole group.
        var used = new HashSet<Bucket>();
        var totals = new Dictionary<Bucket, (decimal Area, decimal Total)>();

        foreach (var line in lines.Where(l => l.IsIncluded))
        {
            var bucket = ResolveBucketByItemKey(line.ItemKey)
                ?? ResolveBucket(line.StructureKind, line.Label, used);
            used.Add(bucket);

            var prev = totals.TryGetValue(bucket, out var t) ? t : (Area: 0m, Total: 0m);
            totals[bucket] = (prev.Area + line.AreaSqm, prev.Total + line.AreaSqm * line.UnitCostSar);
        }

        foreach (var (bucket, sum) in totals)
            WriteTriplet(bag, bucket, sum.Area, sum.Total);

        var annexAreaSum =
            (totals.TryGetValue(Bucket.AnnexGround, out var ag) ? ag.Area : 0m)
            + (totals.TryGetValue(Bucket.AnnexUpper, out var au) ? au.Area : 0m);
        if (annexAreaSum > 0m)
            bag["inventory.7270"] = FormatQty(annexAreaSum);
    }

 /// <summary>item keys route deterministically — label heuristics are the fallback only.</summary>
    private static Bucket? ResolveBucketByItemKey(string? itemKey) =>
        (itemKey ?? "").Trim().ToLowerInvariant() switch
        {
            CostLineItemKeys.Basement => Bucket.Basement,
            CostLineItemKeys.GroundFloor => Bucket.GroundFloor,
            CostLineItemKeys.FirstFloor => Bucket.FirstFloor,
            CostLineItemKeys.RepeatedFloors => Bucket.RepeatedFloor,
            CostLineItemKeys.UpperAnnex => Bucket.AnnexUpper,
            CostLineItemKeys.ApartmentArea => Bucket.Apartment,
            CostLineItemKeys.Fence => Bucket.Fence,
            CostLineItemKeys.Pool => Bucket.Pool,
            CostLineItemKeys.Parking => Bucket.Parking,
            CostLineItemKeys.SharedPortion
                or CostLineItemKeys.CentralAc
                or CostLineItemKeys.Elevator
                or CostLineItemKeys.Landscaping
                or CostLineItemKeys.TanksPumps
                or CostLineItemKeys.Electromechanical => Bucket.Other,
            _ => null,
        };

    private static Bucket ResolveBucket(
        string structureKind,
        string label,
        HashSet<Bucket>? used)
    {
        var kind = (structureKind ?? "").Trim().ToLowerInvariant();
        var text = $"{label ?? ""} {kind}";

        if (ContainsAny(text, "شقة", "apartment", "flat"))
            return Bucket.Apartment;
        if (ContainsAny(text, "مسبح", "pool"))
            return Bucket.Pool;
        if (ContainsAny(text, "موقف", "parking", "garage"))
            return Bucket.Parking;

        if (kind == BuildingStructureKinds.Basement || ContainsAny(text, "قبو", "basement"))
            return Bucket.Basement;
        if (kind == BuildingStructureKinds.Fence || ContainsAny(text, "سور", "fence", "wall"))
            return Bucket.Fence;

        if (kind == BuildingStructureKinds.Annex || ContainsAny(text, "ملحق", "annex"))
        {
            if (ContainsAny(text, "علوي", "upper", "roof", "سطح"))
                return Bucket.AnnexUpper;
            return Bucket.AnnexGround;
        }

        if (ContainsAny(text, "أرضي", "ارضى", "ground"))
            return Bucket.GroundFloor;
        if (ContainsAny(text, "أول", "اول", "first"))
            return Bucket.FirstFloor;
        if (ContainsAny(text, "متكرر", "repeated", "typical", "upper floor"))
            return Bucket.RepeatedFloor;

        if (kind is BuildingStructureKinds.Floor or BuildingStructureKinds.Other or "")
            return NextFloorBucket(used);

        return Bucket.Other;
    }

    private static Bucket NextFloorBucket(HashSet<Bucket>? used)
    {
        if (used is null) return Bucket.GroundFloor;
        if (!used.Contains(Bucket.GroundFloor)) return Bucket.GroundFloor;
        if (!used.Contains(Bucket.FirstFloor)) return Bucket.FirstFloor;
        if (!used.Contains(Bucket.RepeatedFloor)) return Bucket.RepeatedFloor;
        return Bucket.Other;
    }

    private static void WriteTriplet(
        IDictionary<string, string?> bag,
        Bucket bucket,
        decimal area,
        decimal total)
    {
        var (areaKey, unitKey, totalKey) = KeysFor(bucket);
        var unit = area > 0m
            ? Math.Round(total / area, 2, MidpointRounding.AwayFromZero)
            : 0m;

        if (area > 0m)
            bag[areaKey] = FormatQty(area);
        if (unit > 0m)
            bag[unitKey] = ValuationReportDisplayRules.FormatMoney(unit);
        if (total > 0m)
            bag[totalKey] = ValuationReportDisplayRules.FormatMoney(total);

 // Catalog maps code 6589 to cost_line.6589 — must match or the code never fills.
        if (bucket == Bucket.Basement && total > 0m)
            bag["cost_line.6589"] = ValuationReportDisplayRules.FormatMoney(total);
    }

    private static (string Area, string Unit, string Total) KeysFor(Bucket bucket) =>
        bucket switch
        {
            Bucket.Apartment => ("cost_line.7051", "cost_line.7052", "cost_line.7053"),
            Bucket.Basement => ("cost_line.7060", "cost_line.7070", "cost_line.7080"),
            Bucket.GroundFloor => ("cost_line.7090", "cost_line.7100", "cost_line.7110"),
            Bucket.FirstFloor => ("cost_line.7150", "cost_line.7160", "cost_line.7170"),
            Bucket.RepeatedFloor => ("cost_line.7180", "cost_line.7190", "cost_line.7200"),
            Bucket.AnnexGround => ("cost_line.7210", "cost_line.7220", "cost_line.7230"),
            Bucket.AnnexUpper => ("cost_line.7240", "cost_line.7250", "cost_line.7260"),
            Bucket.Fence => ("cost_line.7300", "cost_line.7310", "cost_line.7320"),
            Bucket.Pool => ("cost_line.7330", "cost_line.7340", "cost_line.7350"),
            Bucket.Parking => ("cost_line.7390", "cost_line.7400", "cost_line.7410"),
            _ => ("cost_line.7420", "cost_line.7430", "cost_line.7440"),
        };

    private static bool ContainsAny(string haystack, params string[] needles)
    {
        foreach (var n in needles)
        {
            if (haystack.Contains(n, StringComparison.OrdinalIgnoreCase))
                return true;
        }
        return false;
    }

    private static string FormatQty(decimal value) =>
        value.ToString("0.##", System.Globalization.CultureInfo.InvariantCulture);
}
