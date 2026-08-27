namespace RealEstateEval.Domain;

/// <summary>
/// Append-only record of a security, configuration, or business-state change.
/// Callers provide deliberate snapshots so secrets and unrelated fields are never
/// captured implicitly by entity tracking.
/// </summary>
public sealed class AuditLog
{
    public Guid Id { get; set; }
    public string ActorId { get; set; } = "";
    public string Action { get; set; } = "";
    public string EntityType { get; set; } = "";
    public string EntityId { get; set; } = "";
    public string BeforeJson { get; set; } = "null";
    public string AfterJson { get; set; } = "null";
    public DateTime CreatedAtUtc { get; set; }
}

/// <summary>A single field's values before and after a change.</summary>
public sealed record AuditValueChange(object? Before, object? After);
