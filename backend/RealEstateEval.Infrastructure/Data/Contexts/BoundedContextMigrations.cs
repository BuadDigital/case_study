using Microsoft.EntityFrameworkCore;

namespace RealEstateEval.Infrastructure.Data.Contexts;

/// <summary>
/// The per-context migration streams introduced by ADR 0003. Each extracted context records
/// its history in its own schema, so a stream can never claim it applied another owner's
/// migrations, and the deploy-time migrator (ADR 0006) applies the frozen legacy stream first
/// and then these in a fixed order.
/// </summary>
public static class BoundedContextMigrations
{
    /// <summary>Last legacy migration; the legacy stream is frozen at it for extracted schemas.</summary>
    public const string LegacyCutover = "20260730092246_AddPushSubscriptions";
    public const string HistoryTable = "__EFMigrationsHistory";

    /// <summary>Order the deploy migrator applies the context streams in, after the legacy stream.</summary>
    public static IReadOnlyList<Type> ApplyOrder { get; } =
    [
        typeof(AttachmentsDbContext),
        typeof(PlatformDbContext),
        typeof(ValuationDbContext),
        typeof(IdentityDbContext),
    ];

    public static IReadOnlyDictionary<Type, string> HistorySchemaByContext { get; } =
        new Dictionary<Type, string>
        {
            [typeof(AttachmentsDbContext)] = DatabaseSchemas.Attachments,
            [typeof(PlatformDbContext)] = DatabaseSchemas.Platform,
            [typeof(ValuationDbContext)] = DatabaseSchemas.Valuation,
            [typeof(IdentityDbContext)] = DatabaseSchemas.Identity,
        };

    public static string HistorySchemaFor<TContext>()
        where TContext : DbContext =>
        HistorySchemaByContext.TryGetValue(typeof(TContext), out var schema)
            ? schema
            : throw new InvalidOperationException(
                $"{typeof(TContext).Name} has no migrations-history schema. A bounded-context "
                + "DbContext needs its own history table before it can be registered (ADR 0003).");
}
