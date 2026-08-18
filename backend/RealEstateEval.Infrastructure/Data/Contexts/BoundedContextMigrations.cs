using Microsoft.EntityFrameworkCore;

namespace RealEstateEval.Infrastructure.Data.Contexts;

/// <summary>
/// The per-context migration streams introduced by bounded-context split. Each extracted context records
/// its history in its own schema, so a stream can never claim it applied another owner's
/// migrations, and the deploy-time migrator (migration-stream rules) applies the frozen legacy stream first
/// and then these in a fixed order.
/// <para>
/// A8 migration-catalog decomposition: the catalog is keyed by context <em>class name</em>, not
/// <see cref="Type"/>, so a DbContext can move into its context library without this file needing
/// a reference to it. Concrete type lists live with their consumers (DbMigrate, the container-test
/// stream migrator) and are validated against <see cref="ApplyOrder"/> at startup.
/// </para>
/// </summary>
public static class BoundedContextMigrations
{
 /// <summary>Last legacy migration; the legacy stream is frozen at it for extracted schemas.</summary>
    public const string LegacyCutover = "20260802093148_SyncLocationCatalogModelOnLegacy";
    public const string HistoryTable = "__EFMigrationsHistory";

 /// <summary>Order the deploy migrator applies the context streams in, after the legacy stream.</summary>
    public static IReadOnlyList<string> ApplyOrder { get; } =
    [
        "AttachmentsDbContext",
        "PlatformDbContext",
        "ValuationDbContext",
        "IdentityDbContext",
        "FailuresDbContext",
        "OperationsDbContext",
        "FinancialDbContext",
        "CaseStudyDbContext",
        "MessagingDbContext",
    ];

 /// <summary>Migrations-history schema per context class name.</summary>
    public static IReadOnlyDictionary<string, string> HistorySchemaByContextName { get; } =
        new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["AttachmentsDbContext"] = DatabaseSchemas.Attachments,
            ["PlatformDbContext"] = DatabaseSchemas.Platform,
            ["ValuationDbContext"] = DatabaseSchemas.Valuation,
            ["IdentityDbContext"] = DatabaseSchemas.Identity,
            ["FailuresDbContext"] = DatabaseSchemas.Failures,
            ["OperationsDbContext"] = DatabaseSchemas.Operations,
            ["FinancialDbContext"] = DatabaseSchemas.Financial,
            ["CaseStudyDbContext"] = DatabaseSchemas.CaseStudy,
            ["MessagingDbContext"] = DatabaseSchemas.Messaging,
        };

    public static string HistorySchemaFor<TContext>()
        where TContext : DbContext =>
        HistorySchemaByContextName.TryGetValue(typeof(TContext).Name, out var schema)
            ? schema
            : throw new InvalidOperationException(
                $"{typeof(TContext).Name} has no migrations-history schema. A bounded-context "
 + "DbContext needs its own history table before it can be registered.");
}

/// <summary>
/// Marker registered by <c>AddBoundedContextPersistence</c> for every context stream a host
/// composes, so startup migration loops can enumerate the registered streams without the
/// catalog naming concrete context types.
/// </summary>
public sealed record BoundedContextStreamRegistration(Type ContextType);
