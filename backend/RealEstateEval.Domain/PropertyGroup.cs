namespace RealEstateEval.Domain;

/// <summary>
/// العقار المجمع linking entity: deeds scattered
/// across work orders link to one grouped property. Work orders stay administratively
/// independent; each deed keeps its own rule. Comparable/cost/weighting
/// distribution across units belongs to the grouped-property workshop.
/// </summary>
public class PropertyGroup
{
    public Guid Id { get; set; }
 /// <summary>Optional display name (e.g. مخطط/مالك).</summary>
    public string? Name { get; set; }
    public DateTime CreatedAtUtc { get; set; }

    public ICollection<PropertyGroupMember> Members { get; set; } = [];
}

/// <summary>One linked deed/property — human-confirmed, unlinkable with a reason.</summary>
public class PropertyGroupMember
{
    public Guid Id { get; set; }
    public Guid GroupId { get; set; }
    public Guid PropertyId { get; set; }
 /// <summary>Human confirmation actor (دارس الحالة/المقيّم) — stage 1.</summary>
    public string LinkedByUserId { get; set; } = "";
    public DateTime LinkedAtUtc { get; set; }
 /// <summary>Signals that suggested the link, comma-separated codes (provenance).</summary>
    public string? SuggestionSignals { get; set; }
    public bool IsActive { get; set; } = true;
 /// <summary>Unlink requires a reason (قابل للفك بمبرر).</summary>
    public string? UnlinkReason { get; set; }
    public string? UnlinkedByUserId { get; set; }
    public DateTime? UnlinkedAtUtc { get; set; }

    public PropertyGroup? Group { get; set; }
}

/// <summary>stage-1 suggestion signals.</summary>
public static class PropertyGroupSignals
{
    public const string SameOwner = "same_owner";
    public const string SamePlan = "same_plan";
    public const string AdjacentPlots = "adjacent_plots";
    public const string CoordinateProximity = "coordinate_proximity";

    public static string LabelAr(string code) => code switch
    {
        SameOwner => "نفس المالك",
        SamePlan => "نفس المخطط",
        AdjacentPlots => "تجاور القطع",
        CoordinateProximity => "تقارب الإحداثيات",
        _ => code,
    };
}

public static class PropertyGroupRules
{
 /// <summary>Coordinate-proximity threshold for the suggestion signal.</summary>
    public const decimal ProximityKm = 0.3m;

    public sealed record CandidateInput(
        string? OwnerName,
        string? PlanNumber,
        string? PlotNumber,
        decimal? Latitude,
        decimal? Longitude);

 /// <summary>Signals for a candidate pair — empty list = no suggestion.</summary>
    public static IReadOnlyList<string> EvaluateSignals(CandidateInput subject, CandidateInput candidate)
    {
        var signals = new List<string>();

        if (!string.IsNullOrWhiteSpace(subject.OwnerName)
            && string.Equals(
                Normalize(subject.OwnerName), Normalize(candidate.OwnerName), StringComparison.Ordinal))
        {
            signals.Add(PropertyGroupSignals.SameOwner);
        }

        var samePlan = !string.IsNullOrWhiteSpace(subject.PlanNumber)
            && string.Equals(
                Normalize(subject.PlanNumber), Normalize(candidate.PlanNumber), StringComparison.Ordinal);
        if (samePlan)
        {
            signals.Add(PropertyGroupSignals.SamePlan);
            if (ArePlotsAdjacent(subject.PlotNumber, candidate.PlotNumber))
                signals.Add(PropertyGroupSignals.AdjacentPlots);
        }

        if (subject is { Latitude: { } sLat, Longitude: { } sLon }
            && candidate is { Latitude: { } cLat, Longitude: { } cLon }
            && ComparableProximityRules.HasUsableCoordinates(sLat, sLon)
            && ComparableProximityRules.HasUsableCoordinates(cLat, cLon)
            && ComparableProximityRules.DistanceKm(sLat, sLon, cLat, cLon) <= ProximityKm)
        {
            signals.Add(PropertyGroupSignals.CoordinateProximity);
        }

        return signals;
    }

 /// <summary>Adjacent when both plot numbers are numeric and differ by exactly one.</summary>
    public static bool ArePlotsAdjacent(string? plotA, string? plotB)
    {
        if (!long.TryParse(Normalize(plotA), out var a)) return false;
        if (!long.TryParse(Normalize(plotB), out var b)) return false;
        return Math.Abs(a - b) == 1;
    }

    private static string Normalize(string? value) => (value ?? "").Trim();
}
