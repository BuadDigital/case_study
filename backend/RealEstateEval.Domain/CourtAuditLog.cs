namespace RealEstateEval.Domain;

/// <summary>سجل تدقيق لعمليات إدارة المحاكم والدوائر.</summary>
public class CourtAuditLog
{
    public Guid Id { get; set; }
    /// <summary>مثل COURT_CREATED / CIRCUIT_ACTIVATED.</summary>
    public string Action { get; set; } = "";
    /// <summary>court | circuit</summary>
    public string EntityType { get; set; } = "";
    public Guid EntityId { get; set; }
    public string ActorId { get; set; } = "";
    /// <summary>JSON: { field: { before, after } }</summary>
    public string ChangesJson { get; set; } = "{}";
    public DateTime TimestampUtc { get; set; }
}

public static class CourtAuditActions
{
    public const string CourtCreated = "COURT_CREATED";
    public const string CourtUpdated = "COURT_UPDATED";
    public const string CourtActivated = "COURT_ACTIVATED";
    public const string CourtDeactivated = "COURT_DEACTIVATED";
    public const string CircuitCreated = "CIRCUIT_CREATED";
    public const string CircuitUpdated = "CIRCUIT_UPDATED";
    public const string CircuitActivated = "CIRCUIT_ACTIVATED";
    public const string CircuitDeactivated = "CIRCUIT_DEACTIVATED";
}

public static class CourtAuditEntityTypes
{
    public const string Court = "court";
    public const string Circuit = "circuit";
}
