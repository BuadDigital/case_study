namespace RealEstateEval.Application.Contracts;

public class PropertyTimelineEventDto
{
    public string Id { get; set; } = "";
    public string At { get; set; } = "";
    public string Title { get; set; } = "";
    public string? Detail { get; set; }
    public string Tone { get; set; } = "done";
}
