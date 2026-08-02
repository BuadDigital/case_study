namespace RealEstateEval.Domain;

/// <summary>
/// EXIF captured before compression (هـ). Distance/flag stamped at upload (phase 2).
/// </summary>
public class PhotoMetadata
{
    public Guid Id { get; set; }
    public Guid PhotoId { get; set; }
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public DateTime? CapturedAtUtc { get; set; }
    public double? DistanceM { get; set; }
    public string? Flag { get; set; }
    public DateTime CreatedAtUtc { get; set; }
}
