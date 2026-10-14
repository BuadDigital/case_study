namespace RealEstateEval.Infrastructure.Data;

public sealed class DatabaseOptions
{
    public const string SectionName = "Database";

 /// <summary>
 /// Max connections in each Npgsql pool. The conservative default fits the full
 /// single-host topology under PostgreSQL's default connection limit.
 /// </summary>
    public int MaxPoolSize { get; set; } = 3;

    public int MinPoolSize { get; set; } = 0;

 /// <summary>PostgreSQL server-wide <c>max_connections</c>.</summary>
    public int ServerMaxConnections { get; set; } = 100;

 /// <summary>Connections reserved for administration, migrations, and incident response.</summary>
    public int ReservedServerConnections { get; set; } = 15;

 /// <summary>
 /// Maximum simultaneous Npgsql pools across all service replicas, including rolling-deploy
 /// overlap. The current topology has 13 steady-state pools and a peak factor of two.
 /// </summary>
    public int PeakApplicationPoolCount { get; set; } = 26;

    public int ConnectionTimeoutSeconds { get; set; } = 15;

    public int ConnectionIdleLifetimeSeconds { get; set; } = 300;

    public int CommandTimeoutSeconds { get; set; } = 30;

 /// <summary>Default page size when <c>page</c> is supplied without <c>pageSize</c>.</summary>
    public int DefaultPageSize { get; set; } = 100;

 /// <summary>Hard cap on page size for list endpoints.</summary>
    public int MaxPageSize { get; set; } = 500;

 /// <summary>
 /// When list endpoints are called without pagination, return at most this many rows.
 /// Set to 0 only for a deliberate, trusted internal workload.
 /// </summary>
    public int UnpaginatedListCap { get; set; } = 500;
}
