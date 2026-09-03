namespace RealEstateEval.Domain;

/// <summary>Per-user in-app notification (messaging schema).</summary>
public class UserNotification
{
    public Guid Id { get; set; }
    public string UserId { get; set; } = "";
    public string Title { get; set; } = "";
    public string? Body { get; set; }
    public string? Href { get; set; }
    public string? Tone { get; set; }
    public string? Category { get; set; }
    public string? EntityType { get; set; }
    public string? EntityId { get; set; }
    public string? Actor { get; set; }
    public string? SourceEvent { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime? ReadAtUtc { get; set; }
}
