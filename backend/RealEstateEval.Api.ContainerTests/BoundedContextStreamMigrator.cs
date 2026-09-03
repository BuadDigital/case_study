using Microsoft.EntityFrameworkCore;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Attachments.Infrastructure.Data.Contexts;
using RealEstateEval.Platform.Infrastructure.Data.Contexts;
using RealEstateEval.Valuation.Infrastructure.Data.Contexts;
using RealEstateEval.Identity.Infrastructure.Data.Contexts;
using RealEstateEval.Failures.Infrastructure.Data.Contexts;
using RealEstateEval.Operations.Infrastructure.Data.Contexts;
using RealEstateEval.Financial.Infrastructure.Data.Contexts;
using RealEstateEval.CaseStudy.Infrastructure.Data.Contexts;

namespace RealEstateEval.Api.ContainerTests;

/// <summary>
/// Applies every bounded-context migration stream to one database, mirroring the deploy
/// migrator. The legacy stream stops at the bounded-context cutover, so tests that query
/// post-cutover columns (e.g. WorkOrder.ClientId) must apply these streams on top.
/// </summary>
internal static class BoundedContextStreamMigrator
{
    // A8: the catalog's ApplyOrder is name-keyed; this concrete list mirrors the deploy
    // migrator's and is validated against the catalog so drift fails the suite loudly.
    public static IReadOnlyList<Type> StreamTypes { get; } =
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

    static BoundedContextStreamMigrator()
    {
        if (!StreamTypes.Select(type => type.Name)
                .SequenceEqual(BoundedContextMigrations.ApplyOrder, StringComparer.Ordinal))
        {
            throw new InvalidOperationException(
                "BoundedContextStreamMigrator's stream list is out of sync with "
                + "BoundedContextMigrations.ApplyOrder.");
        }
    }

    public static async Task ApplyAllStreamsAsync(string connectionString)
    {
        foreach (var contextType in StreamTypes)
        {
            await using var stream = CreateStreamContext(contextType, connectionString);
            await stream.Database.MigrateAsync();
        }
    }

    public static DbContext CreateStreamContext(Type contextType, string connectionString)
    {
        if (contextType == typeof(AttachmentsDbContext))
            return new AttachmentsDbContext(StreamOptions<AttachmentsDbContext>(connectionString));
        if (contextType == typeof(PlatformDbContext))
            return new PlatformDbContext(StreamOptions<PlatformDbContext>(connectionString));
        if (contextType == typeof(ValuationDbContext))
            return new ValuationDbContext(StreamOptions<ValuationDbContext>(connectionString));
        if (contextType == typeof(IdentityDbContext))
            return new IdentityDbContext(StreamOptions<IdentityDbContext>(connectionString));
        if (contextType == typeof(FailuresDbContext))
            return new FailuresDbContext(StreamOptions<FailuresDbContext>(connectionString));
        if (contextType == typeof(OperationsDbContext))
            return new OperationsDbContext(StreamOptions<OperationsDbContext>(connectionString));
        if (contextType == typeof(FinancialDbContext))
            return new FinancialDbContext(StreamOptions<FinancialDbContext>(connectionString));
        if (contextType == typeof(CaseStudyDbContext))
            return new CaseStudyDbContext(StreamOptions<CaseStudyDbContext>(connectionString));
        if (contextType == typeof(MessagingDbContext))
            return new MessagingDbContext(StreamOptions<MessagingDbContext>(connectionString));
        throw new InvalidOperationException($"Unknown bounded-context type {contextType.Name}.");
    }

    private static DbContextOptions<TContext> StreamOptions<TContext>(string connectionString)
        where TContext : DbContext =>
        new DbContextOptionsBuilder<TContext>()
            .UseNpgsql(connectionString, npgsql => npgsql.MigrationsHistoryTable(
                BoundedContextMigrations.HistoryTable,
                BoundedContextMigrations.HistorySchemaFor<TContext>()))
            .Options;
}
