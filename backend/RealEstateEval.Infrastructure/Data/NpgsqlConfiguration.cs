using Microsoft.Extensions.Configuration;
using Npgsql;

namespace RealEstateEval.Infrastructure.Data;

public static class NpgsqlConfiguration
{
    public static string EnhanceConnectionString(string connectionString, IConfiguration configuration)
    {
        var options = configuration.GetSection(DatabaseOptions.SectionName).Get<DatabaseOptions>()
            ?? new DatabaseOptions();

        var builder = new NpgsqlConnectionStringBuilder(connectionString)
        {
            MaxPoolSize = options.MaxPoolSize,
            MinPoolSize = options.MinPoolSize,
            Timeout = options.ConnectionTimeoutSeconds,
            ConnectionIdleLifetime = options.ConnectionIdleLifetimeSeconds,
            Pooling = true,
        };

        return builder.ConnectionString;
    }

    public static (int skip, int take, int page, bool isPaged) ResolveListPaging(
        int? page,
        int? pageSize,
        DatabaseOptions options)
    {
        if (page is null && pageSize is null)
        {
            var cap = options.UnpaginatedListCap;
            if (cap > 0)
                return (0, cap, 1, false);

            return (0, int.MaxValue, 1, false);
        }

        var resolvedPage = Math.Max(1, page ?? 1);
        var resolvedSize = Math.Clamp(
            pageSize ?? options.DefaultPageSize,
            1,
            options.MaxPageSize);
        return ((resolvedPage - 1) * resolvedSize, resolvedSize, resolvedPage, true);
    }
}
