using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace RealEstateEval.Infrastructure.Data;

/// <summary>
/// Database-level guards for columns whose allowed values the domain already fixes: status
/// strings that must be one of a constants class, and money / area / count columns that can
/// never be negative. The SQL is generated from the same constants the code writes, so the
/// constraint and the domain cannot drift apart; every expression tolerates NULL so it can be
/// applied to optional and required columns alike (NOT NULL is enforced separately).
/// </summary>
public static class ModelCheckConstraints
{
    /// <summary>Adds <c>CK_{table}_{column}</c>: the column is NULL or one of <paramref name="values"/>.</summary>
    public static EntityTypeBuilder<TEntity> HasAllowedValues<TEntity>(
        this EntityTypeBuilder<TEntity> entity,
        string table,
        string column,
        IEnumerable<string> values)
        where TEntity : class
    {
        var list = string.Join(", ", values.Distinct(StringComparer.Ordinal).Select(Quote));
        if (list.Length == 0)
            throw new ArgumentException("At least one allowed value is required.", nameof(values));

        entity.ToTable(t => t.HasCheckConstraint(
            $"CK_{table}_{column}",
            $"\"{column}\" IS NULL OR \"{column}\" IN ({list})"));
        return entity;
    }

    /// <summary>Adds <c>CK_{table}_{column}_NonNegative</c> for each column: NULL or <c>&gt;= 0</c>.</summary>
    public static EntityTypeBuilder<TEntity> HasNonNegative<TEntity>(
        this EntityTypeBuilder<TEntity> entity,
        string table,
        params string[] columns)
        where TEntity : class
    {
        foreach (var column in columns)
        {
            entity.ToTable(t => t.HasCheckConstraint(
                $"CK_{table}_{column}_NonNegative",
                $"\"{column}\" IS NULL OR \"{column}\" >= 0"));
        }

        return entity;
    }

    private static string Quote(string value) => $"'{value.Replace("'", "''", StringComparison.Ordinal)}'";
}
