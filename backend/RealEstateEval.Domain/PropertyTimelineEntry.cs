namespace RealEstateEval.Domain;

/// <summary>Immutable audit row for property detail timeline / سجل الإجراءات.</summary>
public class PropertyTimelineEntry
{
    public Guid Id { get; set; }
    public string PoNumber { get; set; } = "";
    public Guid PropertyId { get; set; }
    /// <summary>Stable key per property — prevents duplicate milestones.</summary>
    public string EventKey { get; set; } = "";
    public string Title { get; set; } = "";
    public string? Detail { get; set; }
    /// <summary>done | active | warn | muted</summary>
    public string Tone { get; set; } = "done";
    public DateTime OccurredAtUtc { get; set; }
    public DateTime RecordedAtUtc { get; set; }
}
