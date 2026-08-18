using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Infrastructure.Data.Contexts;

/// <summary>
/// Lets <c>dotnet ef</c> build a bounded-context model without a host. Generating or scripting
/// a migration never opens the connection, so the placeholder is only used when the
/// dedicated <c>REAL_ESTATE_EVAL_PG_CONNECTION_STRING_{SERVICE}</c> is unset.
/// </summary>
public abstract class BoundedContextDesignTimeFactory<TContext> : IDesignTimeDbContextFactory<TContext>
    where TContext : DbContext
{
    private const string PlaceholderConnectionString =
        "Host=localhost;Database=realestate_eval_design_time;Username=postgres;Password=postgres";

    public TContext CreateDbContext(string[] args)
    {
        var serviceName = BoundedContextConnections.ServiceNameFor(typeof(TContext));
        var connectionString =
            (serviceName is null
                ? null
                : Environment.GetEnvironmentVariable(BoundedContextConnections.EnvVarFor(serviceName)))
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

public sealed class FinancialDbContextDesignTimeFactory
    : BoundedContextDesignTimeFactory<FinancialDbContext>
{
    protected override FinancialDbContext Create(DbContextOptions<FinancialDbContext> options) =>
        new(options);
}

public sealed class CaseStudyDbContextDesignTimeFactory
    : BoundedContextDesignTimeFactory<CaseStudyDbContext>
{
    protected override CaseStudyDbContext Create(DbContextOptions<CaseStudyDbContext> options) =>
        new(options);
}

public sealed class MessagingDbContextDesignTimeFactory
    : BoundedContextDesignTimeFactory<MessagingDbContext>
{
    protected override MessagingDbContext Create(DbContextOptions<MessagingDbContext> options) =>
        new(options);
}
