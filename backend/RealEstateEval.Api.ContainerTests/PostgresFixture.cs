using System.Text.RegularExpressions;
using Npgsql;
using Testcontainers.PostgreSql;

namespace RealEstateEval.Api.ContainerTests;

/// <summary>
/// One throwaway Postgres per test run. Shared through a collection so the image is pulled and
/// started once, and left unmigrated so migration tests can drive the schema themselves.
/// </summary>
public sealed class PostgresFixture : IAsyncLifetime
{
    private PostgreSqlContainer? _container;

    public string ConnectionString =>
        _container?.GetConnectionString()
        ?? throw new InvalidOperationException("Postgres container is not running.");

    public async Task InitializeAsync()
    {
        if (!DockerEnvironment.IsAvailable)
            return;

        _container = new PostgreSqlBuilder("postgres:16-alpine")
            .WithDatabase("realestate_eval_container_test")
            .WithUsername("postgres")
            .WithPassword("postgres")
            .Build();

        await _container.StartAsync();
    }

    /// <summary>
    /// Creates an empty database on the same server, so a test that needs an unmigrated schema
    /// does not depend on which test ran first. Fails if the name is already taken.
    /// </summary>
    public async Task<string> CreateDatabaseAsync(string name)
    {
        RequireIdentifier(name);

        await using var connection = new NpgsqlConnection(ConnectionString);
        await connection.OpenAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = $"CREATE DATABASE {name}";
        await command.ExecuteNonQueryAsync();

        return ConnectionStringFor(name);
    }

    /// <summary>
    /// Creates the database only if it is not there yet, for tests in one class that share a
    /// single migrated database. xUnit constructs a new instance of the class per test, so the
    /// per-test setup runs repeatedly and has to be idempotent. Tests in a collection run
    /// sequentially, so the check and the create cannot interleave.
    /// </summary>
    public async Task<string> EnsureDatabaseAsync(string name)
    {
        RequireIdentifier(name);

        await using var connection = new NpgsqlConnection(ConnectionString);
        await connection.OpenAsync();

        await using var probe = connection.CreateCommand();
        probe.CommandText = "SELECT 1 FROM pg_database WHERE datname = @name";
        probe.Parameters.AddWithValue("name", name);

        if (await probe.ExecuteScalarAsync() is null)
        {
            await using var create = connection.CreateCommand();
            create.CommandText = $"CREATE DATABASE {name}";
            await create.ExecuteNonQueryAsync();
        }

        return ConnectionStringFor(name);
    }

    private string ConnectionStringFor(string name) =>
        new NpgsqlConnectionStringBuilder(ConnectionString) { Database = name }.ConnectionString;

    private static void RequireIdentifier(string name)
    {
        if (!Regex.IsMatch(name, "^[a-z][a-z0-9_]{0,48}$"))
            throw new ArgumentException("Database names are lowercase identifiers.", nameof(name));
    }

    public async Task DisposeAsync()
    {
        if (_container is not null)
            await _container.DisposeAsync();
    }
}

[CollectionDefinition(Name)]
public sealed class PostgresCollection : ICollectionFixture<PostgresFixture>
{
    public const string Name = "postgres-container";
}
