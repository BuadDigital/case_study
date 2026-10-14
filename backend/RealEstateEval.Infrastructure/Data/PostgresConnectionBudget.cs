namespace RealEstateEval.Infrastructure.Data;

/// <summary>
/// Validates the aggregate Npgsql pool ceiling against PostgreSQL's server-wide
/// connection limit. The inputs are configuration so deployment topology changes
/// cannot silently invalidate a hard-coded calculation.
/// </summary>
public static class PostgresConnectionBudget
{
    public static int MaxSafePoolSize(
        int serverMaxConnections,
        int reservedServerConnections,
        int peakApplicationPoolCount)
    {
        if (serverMaxConnections <= 0
            || reservedServerConnections < 0
            || peakApplicationPoolCount <= 0
            || reservedServerConnections >= serverMaxConnections)
        {
            return 0;
        }

        return (serverMaxConnections - reservedServerConnections)
            / peakApplicationPoolCount;
    }

    public static bool Fits(DatabaseOptions options) =>
        options.MaxPoolSize > 0
        && options.MaxPoolSize <= MaxSafePoolSize(
            options.ServerMaxConnections,
            options.ReservedServerConnections,
            options.PeakApplicationPoolCount);

    public static string ValidationMessage(DatabaseOptions options)
    {
        var safePoolSize = MaxSafePoolSize(
            options.ServerMaxConnections,
            options.ReservedServerConnections,
            options.PeakApplicationPoolCount);
        return "Database:MaxPoolSize exceeds the aggregate PostgreSQL connection budget. "
            + $"Configured {options.MaxPoolSize} per pool across "
            + $"{options.PeakApplicationPoolCount} peak pools, with "
            + $"{options.ReservedServerConnections} connections reserved from "
            + $"server max_connections={options.ServerMaxConnections}; "
            + $"the maximum safe per-pool value is {safePoolSize}.";
    }
}
