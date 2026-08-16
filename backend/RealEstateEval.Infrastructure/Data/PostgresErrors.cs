using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace RealEstateEval.Infrastructure.Data;

/// <summary>Maps PostgreSQL constraint failures onto the rules that declared them.</summary>
public static class PostgresErrors
{
    private const string UniqueViolationSqlState = "23505";

 /// <summary>Name of the unique index a failed save violated, or <c>null</c>.</summary>
    public static string? ViolatedUniqueIndex(DbUpdateException exception) =>
        exception.InnerException is PostgresException { SqlState: UniqueViolationSqlState } violation
            ? violation.ConstraintName
            : null;

    public static bool IsUniqueViolation(DbUpdateException exception, string indexName) =>
        string.Equals(ViolatedUniqueIndex(exception), indexName, StringComparison.Ordinal);
}
