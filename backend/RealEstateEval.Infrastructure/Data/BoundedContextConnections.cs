using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Infrastructure.Data;

/// <summary>
/// Resolves the physical database for a bounded-context stream. Dedicated
/// <c>REAL_ESTATE_EVAL_PG_CONNECTION_STRING_{SERVICE}</c> / <c>ConnectionStrings:{Service}</c>
/// values are required. There is no leftover shared-database fallback.
/// </summary>
public static class BoundedContextConnections
{
    public const string SharedEnvVar = "REAL_ESTATE_EVAL_PG_CONNECTION_STRING";

    public static class ServiceNames
    {
        public const string Attachments = "Attachments";
        public const string Platform = "Platform";
        public const string Valuation = "Valuation";
        public const string Identity = "Identity";
        public const string Failures = "Failures";
        public const string Operations = "Operations";
        public const string Financial = "Financial";
        public const string CaseStudy = "CaseStudy";
        public const string Messaging = "Messaging";

        public static readonly string[] All =
        [
            Attachments,
            Platform,
            Valuation,
            Identity,
            Failures,
            Operations,
            Financial,
            CaseStudy,
            Messaging,
        ];
    }

    public static string EnvVarFor(string serviceName) =>
        $"{SharedEnvVar}_{serviceName.ToUpperInvariant()}";

    public static string? TryGetDedicated(IConfiguration configuration, string serviceName)
    {
        var fromEnv = Environment.GetEnvironmentVariable(EnvVarFor(serviceName));
        if (!string.IsNullOrWhiteSpace(fromEnv))
            return fromEnv;

        var fromConfig = configuration.GetConnectionString(serviceName);
        return string.IsNullOrWhiteSpace(fromConfig) ? null : fromConfig;
    }

    public static string Resolve(
        IConfiguration configuration,
        string serviceName,
        string? leftoverIgnored = null) =>
        TryGetDedicated(configuration, serviceName)
        ?? throw new InvalidOperationException(
            $"Set {EnvVarFor(serviceName)} or ConnectionStrings:{serviceName}. "
            + "Extracted owners do not fall back to a shared database.");

    // A8 migration-catalog decomposition: keyed by context class name so context types can
    // move into their context libraries without this file referencing them.
    private static readonly IReadOnlyDictionary<string, string> ServiceNameByContextName =
        new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["AttachmentsDbContext"] = ServiceNames.Attachments,
            ["PlatformDbContext"] = ServiceNames.Platform,
            ["ValuationDbContext"] = ServiceNames.Valuation,
            ["IdentityDbContext"] = ServiceNames.Identity,
            ["FailuresDbContext"] = ServiceNames.Failures,
            ["OperationsDbContext"] = ServiceNames.Operations,
            ["FinancialDbContext"] = ServiceNames.Financial,
            ["CaseStudyDbContext"] = ServiceNames.CaseStudy,
            ["MessagingDbContext"] = ServiceNames.Messaging,
        };

    public static string? ServiceNameFor(Type contextType) =>
        ServiceNameByContextName.TryGetValue(contextType.Name, out var name) ? name : null;

    public static string ForContext(
        IConfiguration configuration,
        Type contextType)
    {
        var serviceName = ServiceNameFor(contextType)
            ?? throw new InvalidOperationException(
                $"{contextType.Name} has no dedicated database.");
        return Resolve(configuration, serviceName);
    }

    public static string ForContext(
        IConfiguration configuration,
        Type contextType,
        string leftoverIgnored) =>
        ForContext(configuration, contextType);

    public static string ForContext<TContext>(
        IConfiguration configuration,
        string leftoverIgnored)
        where TContext : DbContext =>
        ForContext(configuration, typeof(TContext));

    public static string ForContext<TContext>(IConfiguration configuration)
        where TContext : DbContext =>
        ForContext(configuration, typeof(TContext));

    public static void ApplyDedicatedSettings(Action<string, string?> set, string connectionString)
    {
        foreach (var name in ServiceNames.All)
            set($"ConnectionStrings:{name}", connectionString);
    }
}
