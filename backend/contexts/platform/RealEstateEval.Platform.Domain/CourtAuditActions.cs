namespace RealEstateEval.Platform.Domain;

/// <summary>Action names CourtsService writes to platform.AuditLogs for court and circuit changes.</summary>
public static class CourtAuditActions
{
    public const string CourtCreated = "COURT_CREATED";
    public const string CourtUpdated = "COURT_UPDATED";
    public const string CircuitCreated = "CIRCUIT_CREATED";
    public const string CircuitUpdated = "CIRCUIT_UPDATED";
    public const string CircuitActivated = "CIRCUIT_ACTIVATED";
    public const string CircuitDeactivated = "CIRCUIT_DEACTIVATED";
}

/// <summary>Entity-type values that accompany <see cref="CourtAuditActions"/>.</summary>
public static class CourtAuditEntityTypes
{
    public const string Court = "court";
    public const string Circuit = "circuit";
}
