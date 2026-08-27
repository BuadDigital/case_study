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

// A8 physical move: AttachmentsDbContextDesignTimeFactory lives beside its context in
// contexts/attachments (RealEstateEval.Attachments.Infrastructure/Data).

// A8 physical move: PlatformDbContextDesignTimeFactory lives beside its context library.

// A8 physical move: ValuationDbContextDesignTimeFactory lives beside its context library.

// A8 physical move: IdentityDbContextDesignTimeFactory lives beside its context library.

// A8 physical move: FailuresDbContextDesignTimeFactory lives beside its context library.

// A8 physical move: OperationsDbContextDesignTimeFactory lives beside its context library.

// A8 physical move: FinancialDbContextDesignTimeFactory lives beside its context library.

// A8 physical move: CaseStudyDbContextDesignTimeFactory lives beside its context library.

public sealed class MessagingDbContextDesignTimeFactory
    : BoundedContextDesignTimeFactory<MessagingDbContext>
{
    protected override MessagingDbContext Create(DbContextOptions<MessagingDbContext> options) =>
        new(options);
}
