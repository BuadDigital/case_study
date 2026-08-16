namespace RealEstateEval.Infrastructure.Data;

public sealed class DatabaseOptions
{
    public const string SectionName = "Database";

 /// <summary>Max connections per service process (Npgsql pool).</summary>
    public int MaxPoolSize { get; set; } = 20;

    public int MinPoolSize { get; set; } = 0;

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
