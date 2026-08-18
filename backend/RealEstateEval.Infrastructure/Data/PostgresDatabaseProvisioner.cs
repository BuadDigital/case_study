using System.Text.RegularExpressions;
using Npgsql;

namespace RealEstateEval.Infrastructure.Data;

/// <summary>
/// Creates a PostgreSQL database when a Phase 4 dedicated connection string points at a
/// name that does not exist yet (empty volume, first cutover).
/// </summary>
public static class PostgresDatabaseProvisioner
{
    private static readonly Regex SafeName = new("^[A-Za-z_][A-Za-z0-9_]*$", RegexOptions.CultureInvariant);

    public static async Task EnsureExistsAsync(
        string? connectionString,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(connectionString))
            return;

        var builder = new NpgsqlConnectionStringBuilder(connectionString);
        var database = builder.Database;
        if (string.IsNullOrWhiteSpace(database))
            return;
        if (!SafeName.IsMatch(database))
        {
            throw new InvalidOperationException(
                $"Refusing to create database '{database}': name must be letters, digits, and underscore.");
        }

        builder.Database = "postgres";
        await using var connection = new NpgsqlConnection(builder.ConnectionString);
        await connection.OpenAsync(cancellationToken);

        await using var exists = new NpgsqlCommand(
            "SELECT 1 FROM pg_database WHERE datname = @name",
            connection);
        exists.Parameters.AddWithValue("name", database);
        if (await exists.ExecuteScalarAsync(cancellationToken) is not null)
            return;

        await using var create = new NpgsqlCommand($"CREATE DATABASE {database}", connection);
        await create.ExecuteNonQueryAsync(cancellationToken);
    }
}
