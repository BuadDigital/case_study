using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Attachments.Infrastructure.Data.Contexts;
using RealEstateEval.Platform.Infrastructure.Data.Contexts;
using RealEstateEval.Valuation.Infrastructure.Data.Contexts;
using RealEstateEval.Identity.Infrastructure.Data.Contexts;
using RealEstateEval.Failures.Infrastructure.Data.Contexts;
using RealEstateEval.Operations.Infrastructure.Data.Contexts;
using RealEstateEval.Financial.Infrastructure.Data.Contexts;
using RealEstateEval.CaseStudy.Infrastructure.Data.Contexts;

namespace RealEstateEval.Architecture.Tests.Support;

/// <summary>
/// Reads every <see cref="DbContext"/> the repository declares, so the Phase-1 guardrails can
/// compare what each context actually maps against what the ownership catalog says it owns.
/// Like <see cref="EfModelFacts"/>, no connection is ever opened.
/// </summary>
internal static class BoundedContextFacts
{
    private const string PlaceholderConnection =
        "Host=architecture-tests;Database=model_only;Username=none;Password=none";

 /// <summary>The nine owner-context types, in migration apply order (A10: no legacy).</summary>
    public static IReadOnlyList<Type> ContextTypes { get; } =
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

 /// <summary>Context name to a factory for its model, in apply order.</summary>
    public static IReadOnlyDictionary<string, Func<IModel>> ModelFactories { get; } =
        new Dictionary<string, Func<IModel>>(StringComparer.Ordinal)
        {
            [nameof(AttachmentsDbContext)] = () =>
                Build<AttachmentsDbContext>(options => new AttachmentsDbContext(options)),
            [nameof(PlatformDbContext)] = () =>
                Build<PlatformDbContext>(options => new PlatformDbContext(options)),
            [nameof(ValuationDbContext)] = () =>
                Build<ValuationDbContext>(options => new ValuationDbContext(options)),
            [nameof(IdentityDbContext)] = () =>
                Build<IdentityDbContext>(options => new IdentityDbContext(options)),
            [nameof(FailuresDbContext)] = () =>
                Build<FailuresDbContext>(options => new FailuresDbContext(options)),
            [nameof(OperationsDbContext)] = () =>
                Build<OperationsDbContext>(options => new OperationsDbContext(options)),
            [nameof(FinancialDbContext)] = () =>
                Build<FinancialDbContext>(options => new FinancialDbContext(options)),
            [nameof(CaseStudyDbContext)] = () =>
                Build<CaseStudyDbContext>(options => new CaseStudyDbContext(options)),
            [nameof(MessagingDbContext)] = () =>
                Build<MessagingDbContext>(options => new MessagingDbContext(options)),
        };

 /// <summary>Context name to the tables it maps, as <c>schema.table</c>.</summary>
    public static IReadOnlyDictionary<string, IReadOnlyList<string>> TablesByContext { get; } =
        ModelFactories.ToDictionary(
            entry => entry.Key,
            entry => (IReadOnlyList<string>)entry.Value()
                .GetEntityTypes()
                .Select(entity => (Schema: entity.GetSchema() ?? "", Table: entity.GetTableName() ?? ""))
                .Where(mapping => mapping.Table.Length > 0)
                .Select(mapping => $"{mapping.Schema}.{mapping.Table}")
                .Distinct(StringComparer.Ordinal)
                .OrderBy(name => name, StringComparer.Ordinal)
                .ToList(),
            StringComparer.Ordinal);

 /// <summary>The migrations-history schema each extracted context records itself in.</summary>
    public static IReadOnlyDictionary<string, string> HistorySchemaByContext { get; } =
        BoundedContextMigrations.HistorySchemaByContextName;

    private static IModel Build<TContext>(Func<DbContextOptions<TContext>, TContext> create)
        where TContext : DbContext
    {
        var options = new DbContextOptionsBuilder<TContext>()
            .UseNpgsql(PlaceholderConnection)
            .Options;

        using var context = create(options);
        return context.Model;
    }
}
