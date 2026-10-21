namespace RealEstateEval.Application.Contracts;

public class PropertyTimelineEventDto
{
    public string Id { get; set; } = "";
    public string At { get; set; } = "";
    public string Title { get; set; } = "";
    public string? Detail { get; set; }
    public string Tone { get; set; } = "done";

    /// <summary>Set on a transaction timeline: the deed the event belongs to.</summary>
    public Guid? PropertyId { get; set; }

    /// <summary>Set on a transaction timeline: the deed's label (deed / registry number) for the row.</summary>
    public string? DeedLabel { get; set; }
}
