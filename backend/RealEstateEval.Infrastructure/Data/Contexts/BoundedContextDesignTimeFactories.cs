using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace RealEstateEval.Infrastructure.Data.Contexts;

/// <summary>
/// Lets <c>dotnet ef</c> build a bounded-context model without a host. Generating or scripting
/// a migration never opens the connection, so the placeholder is only used when
/// <c>REAL_ESTATE_EVAL_PG_CONNECTION_STRING</c> is unset and the command needs a database.
/// </summary>
public abstract class BoundedContextDesignTimeFactory<TContext> : IDesignTimeDbContextFactory<TContext>
    where TContext : DbContext
{
    private const string PlaceholderConnectionString =
        "Host=localhost;Database=realestate_eval_dev;Username=postgres;Password=postgres";

    public TContext CreateDbContext(string[] args)
    {
        var connectionString =
            Environment.GetEnvironmentVariable("REAL_ESTATE_EVAL_PG_CONNECTION_STRING")
            ?? PlaceholderConnectionString;

        var options = new DbContextOptionsBuilder<TContext>()
            .UseNpgsql(connectionString, npgsql => npgsql.MigrationsHistoryTable(
                BoundedContextMigrations.HistoryTable,
                BoundedContextMigrations.HistorySchemaFor<TContext>()))
            .Options;

        return Create(options);
    }

    protected abstract TContext Create(DbContextOptions<TContext> options);
}

public sealed class AttachmentsDbContextDesignTimeFactory
    : BoundedContextDesignTimeFactory<AttachmentsDbContext>
{
    protected override AttachmentsDbContext Create(DbContextOptions<AttachmentsDbContext> options) =>
        new(options);
}

public sealed class PlatformDbContextDesignTimeFactory
    : BoundedContextDesignTimeFactory<PlatformDbContext>
{
    protected override PlatformDbContext Create(DbContextOptions<PlatformDbContext> options) =>
        new(options);
}

public sealed class ValuationDbContextDesignTimeFactory
    : BoundedContextDesignTimeFactory<ValuationDbContext>
{
    protected override ValuationDbContext Create(DbContextOptions<ValuationDbContext> options) =>
        new(options);
}

public sealed class IdentityDbContextDesignTimeFactory
    : BoundedContextDesignTimeFactory<IdentityDbContext>
{
    protected override IdentityDbContext Create(DbContextOptions<IdentityDbContext> options) =>
        new(options);
}

public sealed class FailuresDbContextDesignTimeFactory
    : BoundedContextDesignTimeFactory<FailuresDbContext>
{
    protected override FailuresDbContext Create(DbContextOptions<FailuresDbContext> options) =>
        new(options);
}

public sealed class OperationsDbContextDesignTimeFactory
    : BoundedContextDesignTimeFactory<OperationsDbContext>
{
    protected override OperationsDbContext Create(DbContextOptions<OperationsDbContext> options) =>
        new(options);
}
