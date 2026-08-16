using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Data.Contexts;

// Deploy-time EF migrator. Production apps must not run MigrateAsync at startup.
//
// Applies the frozen legacy stream first, then each bounded-context stream in
// BoundedContextMigrations.ApplyOrder. Every stream records itself in its own
// migrations-history table, so they cannot claim each other's migrations (bounded-context split).
//
// Usage:
// RealEstateEval.DbMigrate apply all pending migrations, all streams
// RealEstateEval.DbMigrate update same as above
// RealEstateEval.DbMigrate list show applied and pending, all streams
// RealEstateEval.DbMigrate rollback <name> migrate the legacy stream down to a migration
// RealEstateEval.DbMigrate rollback <name> <stream> roll back one context stream
// RealEstateEval.DbMigrate rollback 0 remove all migrations (empty DB schema target)

var connectionString =
    Environment.GetEnvironmentVariable("REAL_ESTATE_EVAL_PG_CONNECTION_STRING")
    ?? new ConfigurationBuilder()
        .AddEnvironmentVariables()
        .Build()
        .GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException(
        "Set REAL_ESTATE_EVAL_PG_CONNECTION_STRING (or ConnectionStrings__DefaultConnection).");

var services = new ServiceCollection();
services.AddLogging();
services.AddDbContext<ApplicationDbContext>(options => options.UseNpgsql(connectionString));
services.AddDbContext<AttachmentsDbContext>(options => UseStream<AttachmentsDbContext>(options));
services.AddDbContext<PlatformDbContext>(options => UseStream<PlatformDbContext>(options));
services.AddDbContext<ValuationDbContext>(options => UseStream<ValuationDbContext>(options));
services.AddDbContext<IdentityDbContext>(options => UseStream<IdentityDbContext>(options));
services.AddDbContext<FailuresDbContext>(options => UseStream<FailuresDbContext>(options));
services.AddDbContext<OperationsDbContext>(options => UseStream<OperationsDbContext>(options));
services.AddDbContext<FinancialDbContext>(options => UseStream<FinancialDbContext>(options));
services.AddDbContext<CaseStudyDbContext>(options => UseStream<CaseStudyDbContext>(options));
services.AddDbContext<MessagingDbContext>(options => UseStream<MessagingDbContext>(options));

await using var provider = services.BuildServiceProvider();
await using var scope = provider.CreateAsyncScope();

// Legacy first: it is the baseline that created every table the context streams inherit.
var streams = new List<(string Name, DbContext Db)>
{
    (nameof(ApplicationDbContext), scope.ServiceProvider.GetRequiredService<ApplicationDbContext>()),
};
streams.AddRange(BoundedContextMigrations.ApplyOrder.Select(type =>
    (type.Name, (DbContext)scope.ServiceProvider.GetRequiredService(type))));

var command = args.Length > 0 ? args[0].ToLowerInvariant() : "update";

switch (command)
{
    case "update":
    case "migrate":
        foreach (var (name, db) in streams)
        {
            var pending = (await db.Database.GetPendingMigrationsAsync()).ToList();
            if (pending.Count == 0)
            {
                Console.WriteLine($"[migrate] {name}: up to date.");
                continue;
            }

            Console.WriteLine($"[migrate] {name}: applying {pending.Count} migration(s):");
            foreach (var migration in pending)
                Console.WriteLine($"  + {migration}");

            await db.Database.MigrateAsync();
        }

        Console.WriteLine("[migrate] done.");
        break;

    case "list":
        foreach (var (name, db) in streams)
        {
            Console.WriteLine($"[migrate] {name} applied:");
            foreach (var migration in await db.Database.GetAppliedMigrationsAsync())
                Console.WriteLine($"  * {migration}");
            Console.WriteLine($"[migrate] {name} pending:");
            foreach (var migration in await db.Database.GetPendingMigrationsAsync())
                Console.WriteLine($"  + {migration}");
        }

        break;

    case "rollback":
        if (args.Length < 2)
        {
            Console.Error.WriteLine(
                "Usage: RealEstateEval.DbMigrate rollback <MigrationName|0> [ContextName]");
            Console.Error.WriteLine(
                "  Target is the migration to keep (EF migrates down to that point). Use 0 for empty.");
            Console.Error.WriteLine(
                $"  Streams: {string.Join(", ", streams.Select(stream => stream.Name))}.");
            return 1;
        }

        var streamName = args.Length > 2 ? args[2] : nameof(ApplicationDbContext);
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

void UseStream<TContext>(DbContextOptionsBuilder options)
    where TContext : DbContext =>
    options.UseNpgsql(connectionString, npgsql => npgsql.MigrationsHistoryTable(
        BoundedContextMigrations.HistoryTable,
        BoundedContextMigrations.HistorySchemaFor<TContext>()));
