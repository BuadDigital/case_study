using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Data.Contexts;

// Deploy-time EF migrator. Production apps must not run MigrateAsync at startup.
//
// Optional leftover shared database: if REAL_ESTATE_EVAL_PG_CONNECTION_STRING is set,
// apply the frozen legacy ApplicationDbContext stream first (ADR 0006, including xmin).
// Dedicated owner databases still require their own connection strings; production
// compose does not set the unsuffixed leftover variable.
// Then apply each bounded-context stream in BoundedContextMigrations.ApplyOrder.
//
// Usage:
// RealEstateEval.DbMigrate apply all pending migrations, all streams
// RealEstateEval.DbMigrate update same as above
// RealEstateEval.DbMigrate list show applied and pending, all streams
// RealEstateEval.DbMigrate rollback <name> <stream> roll back one context stream
// RealEstateEval.DbMigrate rollback 0 <stream> remove all migrations (empty DB schema target)

var configuration = new ConfigurationBuilder()
    .AddEnvironmentVariables()
    .Build();

var leftoverConnection = Environment.GetEnvironmentVariable(BoundedContextConnections.SharedEnvVar);

// A8: the catalog's ApplyOrder is name-keyed so context types can leave the global assembly.
// This migrator keeps the concrete list and fails loudly if it drifts from the catalog —
// a stream the migrator does not know about would silently never run in production.
IReadOnlyList<Type> streamTypes =
[
    typeof(AttachmentsDbContext),
    typeof(PlatformDbContext),
    typeof(ValuationDbContext),
    typeof(IdentityDbContext),
    typeof(FailuresDbContext),
    typeof(OperationsDbContext),
    typeof(FinancialDbContext),
    typeof(CaseStudyDbContext),
    typeof(MessagingDbContext),
];
if (!streamTypes.Select(type => type.Name)
        .SequenceEqual(BoundedContextMigrations.ApplyOrder, StringComparer.Ordinal))
{
    throw new InvalidOperationException(
        "DbMigrate's stream list is out of sync with BoundedContextMigrations.ApplyOrder. "
        + "Add the missing context stream here before deploying.");
}

var streamConnections = new Dictionary<Type, string>();
foreach (var type in streamTypes)
{
    streamConnections[type] = BoundedContextConnections.ForContext(configuration, type);
}

if (!string.IsNullOrWhiteSpace(leftoverConnection))
{
    Console.WriteLine(
        $"[migrate] ApplicationDbContext uses leftover database '{DatabaseName(leftoverConnection)}'.");
    await PostgresDatabaseProvisioner.EnsureExistsAsync(leftoverConnection);
}

foreach (var connection in streamConnections.Values.Distinct(StringComparer.Ordinal))
    await PostgresDatabaseProvisioner.EnsureExistsAsync(connection);

foreach (var (type, connection) in streamConnections)
{
    Console.WriteLine(
        $"[migrate] {type.Name} uses dedicated database '{DatabaseName(connection)}'.");
}

var services = new ServiceCollection();
services.AddLogging();
if (!string.IsNullOrWhiteSpace(leftoverConnection))
{
    services.AddDbContext<ApplicationDbContext>(options =>
        options.UseNpgsql(leftoverConnection));
}
services.AddDbContext<AttachmentsDbContext>(options =>
    UseStream<AttachmentsDbContext>(options, streamConnections[typeof(AttachmentsDbContext)]));
services.AddDbContext<PlatformDbContext>(options =>
    UseStream<PlatformDbContext>(options, streamConnections[typeof(PlatformDbContext)]));
services.AddDbContext<ValuationDbContext>(options =>
    UseStream<ValuationDbContext>(options, streamConnections[typeof(ValuationDbContext)]));
services.AddDbContext<IdentityDbContext>(options =>
    UseStream<IdentityDbContext>(options, streamConnections[typeof(IdentityDbContext)]));
services.AddDbContext<FailuresDbContext>(options =>
    UseStream<FailuresDbContext>(options, streamConnections[typeof(FailuresDbContext)]));
services.AddDbContext<OperationsDbContext>(options =>
    UseStream<OperationsDbContext>(options, streamConnections[typeof(OperationsDbContext)]));
services.AddDbContext<FinancialDbContext>(options =>
    UseStream<FinancialDbContext>(options, streamConnections[typeof(FinancialDbContext)]));
services.AddDbContext<CaseStudyDbContext>(options =>
    UseStream<CaseStudyDbContext>(options, streamConnections[typeof(CaseStudyDbContext)]));
services.AddDbContext<MessagingDbContext>(options =>
    UseStream<MessagingDbContext>(options, streamConnections[typeof(MessagingDbContext)]));

await using var provider = services.BuildServiceProvider();
await using var scope = provider.CreateAsyncScope();

var streams = streamTypes.Select(type =>
    (
        Name: type.Name,
        Db: (DbContext)scope.ServiceProvider.GetRequiredService(type),
        Connection: streamConnections[type])).ToList();

var command = args.Length > 0 ? args[0].ToLowerInvariant() : "update";

switch (command)
{
    case "update":
    case "migrate":
        if (!string.IsNullOrWhiteSpace(leftoverConnection))
        {
            var legacy = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            await ApplyPendingAsync("ApplicationDbContext", leftoverConnection, legacy);
        }

        foreach (var (name, db, connection) in streams)
            await ApplyPendingAsync(name, connection, db);

        Console.WriteLine("[migrate] done.");
        break;

    case "list":
        if (!string.IsNullOrWhiteSpace(leftoverConnection))
        {
            var legacy = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            await ListStreamAsync("ApplicationDbContext", leftoverConnection, legacy);
        }

        foreach (var (name, db, connection) in streams)
            await ListStreamAsync(name, connection, db);

        break;

    case "rollback":
        if (args.Length < 3)
        {
            Console.Error.WriteLine(
                "Usage: RealEstateEval.DbMigrate rollback <MigrationName|0> <ContextName>");
            Console.Error.WriteLine(
                "  Target is the migration to keep (EF migrates down to that point). Use 0 for empty.");
            Console.Error.WriteLine(
                $"  Streams: {string.Join(", ", streams.Select(stream => stream.Name))}.");
            return 1;
        }

        var streamName = args[2];
        var selected = streams.FirstOrDefault(stream =>
            string.Equals(stream.Name, streamName, StringComparison.OrdinalIgnoreCase));
        if (selected.Db is null)
        {
            Console.Error.WriteLine($"Unknown stream '{streamName}'.");
            return 1;
        }

        var target = args[1];
        if (target is "0" or "empty")
            target = "0";

        Console.WriteLine($"[migrate] {selected.Name}: rolling back to '{target}'…");
        await selected.Db.Database.MigrateAsync(target);
        Console.WriteLine("[migrate] rollback complete.");
        break;

    default:
        Console.Error.WriteLine($"Unknown command '{command}'. Use update | list | rollback.");
        return 1;
}

return 0;

async Task ApplyPendingAsync(string name, string connection, DbContext db)
{
    var database = DatabaseName(connection);
    var pending = (await db.Database.GetPendingMigrationsAsync()).ToList();
    if (pending.Count == 0)
    {
        Console.WriteLine($"[migrate] {name} ({database}): up to date.");
        return;
    }

    Console.WriteLine($"[migrate] {name} ({database}): applying {pending.Count} migration(s):");
    foreach (var migration in pending)
        Console.WriteLine($"  + {migration}");

    await db.Database.MigrateAsync();
}

async Task ListStreamAsync(string name, string connection, DbContext db)
{
    Console.WriteLine($"[migrate] {name} ({DatabaseName(connection)}) applied:");
    foreach (var migration in await db.Database.GetAppliedMigrationsAsync())
        Console.WriteLine($"  * {migration}");
    Console.WriteLine($"[migrate] {name} pending:");
    foreach (var migration in await db.Database.GetPendingMigrationsAsync())
        Console.WriteLine($"  + {migration}");
}

void UseStream<TContext>(DbContextOptionsBuilder options, string connectionString)
    where TContext : DbContext =>
    options
        .ConfigureWarnings(w => w.Ignore(RelationalEventId.PendingModelChangesWarning))
        .UseNpgsql(connectionString, npgsql => npgsql.MigrationsHistoryTable(
            BoundedContextMigrations.HistoryTable,
            BoundedContextMigrations.HistorySchemaFor<TContext>()));

static string DatabaseName(string connectionString) =>
    new NpgsqlConnectionStringBuilder(connectionString).Database ?? "(unknown)";
