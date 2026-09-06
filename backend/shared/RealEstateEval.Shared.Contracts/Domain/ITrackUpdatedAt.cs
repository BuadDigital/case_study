namespace RealEstateEval.Domain;

/// <summary>
/// Rows that change after creation and record when. The persistence layer stamps
/// <see cref="UpdatedAtUtc"/> on every insert and update, so entities implementing this never
/// have to set it themselves; aggregates that already stamp it by hand keep doing so.
/// </summary>
public interface ITrackUpdatedAt
{
    DateTime UpdatedAtUtc { get; set; }
}
