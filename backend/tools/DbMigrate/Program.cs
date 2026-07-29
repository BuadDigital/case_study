using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using RealEstateEval.Infrastructure.Data;

// Deploy-time EF migrator. Production apps must not run MigrateAsync at startup.
//
// Usage:
//   RealEstateEval.DbMigrate                 apply all pending migrations
//   RealEstateEval.DbMigrate update          same as above
//   RealEstateEval.DbMigrate list            show applied and pending
//   RealEstateEval.DbMigrate rollback <name> migrate down to a named migration
//   RealEstateEval.DbMigrate rollback 0      remove all migrations (empty DB schema target)

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

await using var provider = services.BuildServiceProvider();
await using var scope = provider.CreateAsyncScope();
var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

var command = args.Length > 0 ? args[0].ToLowerInvariant() : "update";

switch (command)
{
    case "update":
    case "migrate":
        var pending = (await db.Database.GetPendingMigrationsAsync()).ToList();
        if (pending.Count == 0)
        {
            Console.WriteLine("[migrate] database is up to date.");
            break;
        }

        Console.WriteLine($"[migrate] applying {pending.Count} migration(s):");
        foreach (var name in pending)
            Console.WriteLine($"  + {name}");

        await db.Database.MigrateAsync();
        Console.WriteLine("[migrate] done.");
        break;

    case "list":
        var applied = await db.Database.GetAppliedMigrationsAsync();
        var waiting = await db.Database.GetPendingMigrationsAsync();
        Console.WriteLine("[migrate] applied:");
        foreach (var name in applied)
            Console.WriteLine($"  * {name}");
        Console.WriteLine("[migrate] pending:");
        foreach (var name in waiting)
            Console.WriteLine($"  + {name}");
        break;

    case "rollback":
        if (args.Length < 2)
        {
            Console.Error.WriteLine(
                "Usage: RealEstateEval.DbMigrate rollback <MigrationName|0>");
            Console.Error.WriteLine(
                "  Target is the migration to keep (EF migrates down to that point). Use 0 for empty.");
            return 1;
        }

        var target = args[1];
        if (target is "0" or "empty")
            target = "0";

        Console.WriteLine($"[migrate] rolling back to '{target}'…");
        await db.Database.MigrateAsync(target);
        Console.WriteLine("[migrate] rollback complete.");
        break;

    default:
        Console.Error.WriteLine($"Unknown command '{command}'. Use update | list | rollback.");
        return 1;
}

return 0;
