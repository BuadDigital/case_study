using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Architecture.Tests.Support;

/// <summary>
/// Aggregates the nine owner-context models (A10: the legacy god context is archived).
/// The union of the owner models is the authority for table and schema placement; the
/// ownership catalog is the authority for who may write each table. Contexts that map
/// another owner's table read-only (e.g. Valuation's <c>messaging.OutboxMessages</c>)
/// must agree on schema and table — a conflict here is mapping drift and throws.
/// </summary>
internal static class EfModelFacts
{
 /// <summary>Every owner-context model, in apply order.</summary>
    public static IReadOnlyList<IModel> Models { get; } =
        BoundedContextFacts.ModelFactories.Values.Select(factory => factory()).ToList();

 /// <summary>Mapped table name to schema, unioned across owner contexts.</summary>
    public static IReadOnlyDictionary<string, string> SchemaByTable { get; } = BuildSchemaByTable();

 /// <summary>Public <c>DbSet</c> property name to mapped table name, unioned across contexts.</summary>
    public static IReadOnlyDictionary<string, string> TableByDbSet { get; } = BuildTableByDbSet();

    public static IReadOnlyDictionary<string, string> SchemaByEntityName { get; } =
        BuildSchemaByEntityName();

    public static IReadOnlyList<string> CrossSchemaForeignKeys { get; } = BuildCrossSchemaForeignKeys();

    public static IReadOnlyList<string> CrossSchemaNavigations { get; } = BuildCrossSchemaNavigations();

    public static string? SchemaForDbSet(string dbSetName) =>
        TableByDbSet.TryGetValue(dbSetName, out var table)
            && SchemaByTable.TryGetValue(table, out var schema)
                ? schema
                : null;

    private static Dictionary<string, string> BuildSchemaByTable()
    {
        var result = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var entity in Models.SelectMany(model => model.GetEntityTypes()))
        {
            var table = entity.GetTableName();
            if (string.IsNullOrEmpty(table)) continue;
            var schema = entity.GetSchema() ?? "";
            if (result.TryGetValue(table, out var existing)
                && !string.Equals(existing, schema, StringComparison.Ordinal))
            {
                throw new InvalidOperationException(
                    $"Table '{table}' is mapped to schema '{existing}' by one owner context and "
                    + $"'{schema}' by another. Shared mappings must not drift.");
            }

            result[table] = schema;
        }

        return result;
    }

    private static Dictionary<string, string> BuildSchemaByEntityName()
    {
        var result = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var entity in Models.SelectMany(model => model.GetEntityTypes()))
        {
            var table = entity.GetTableName();
            if (string.IsNullOrEmpty(table)) continue;
            result[entity.ClrType.Name] = entity.GetSchema() ?? "";
        }

        return result;
    }

    private static Dictionary<string, string> BuildTableByDbSet()
    {
        var result = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var (contextType, model) in BoundedContextFacts.ContextTypes
                     .Zip(Models, (type, model) => (type, model)))
        {
            var setProperties = contextType
                .GetProperties()
                .Where(property =>
                    property.PropertyType.IsGenericType
                    && property.PropertyType.GetGenericTypeDefinition() == typeof(DbSet<>));

            foreach (var property in setProperties)
            {
                var clrType = property.PropertyType.GetGenericArguments()[0];
                var entity = model.FindEntityType(clrType);
                var table = entity?.GetTableName();
                if (string.IsNullOrEmpty(table)) continue;
                if (result.TryGetValue(property.Name, out var existing)
                    && !string.Equals(existing, table, StringComparison.Ordinal))
                {
                    throw new InvalidOperationException(
                        $"DbSet '{property.Name}' maps table '{existing}' on one context and "
                        + $"'{table}' on another. Shared mappings must not drift.");
                }

                result[property.Name] = table;
            }
        }

        return result;
    }

    private static List<string> BuildCrossSchemaForeignKeys()
    {
        var links = new SortedSet<string>(StringComparer.Ordinal);
        foreach (var entity in Models.SelectMany(model => model.GetEntityTypes()))
        {
            foreach (var foreignKey in entity.GetForeignKeys())
            {
                var dependent = Describe(foreignKey.DeclaringEntityType);
                var principal = Describe(foreignKey.PrincipalEntityType);
                if (dependent is null || principal is null) continue;
                if (string.Equals(dependent.Schema, principal.Schema, StringComparison.Ordinal)) continue;
                links.Add($"{dependent}->{principal}");
            }
        }

        return links.ToList();
    }

    private static List<string> BuildCrossSchemaNavigations()
    {
        var links = new SortedSet<string>(StringComparer.Ordinal);
        foreach (var entity in Models.SelectMany(model => model.GetEntityTypes()))
        {
            var source = Describe(entity);
            if (source is null) continue;

            foreach (var navigation in entity.GetNavigations())
            {
                var target = Describe(navigation.TargetEntityType);
                if (target is null) continue;
                if (string.Equals(source.Schema, target.Schema, StringComparison.Ordinal)) continue;
                links.Add($"{source}.{navigation.Name}->{target}");
            }
        }

        return links.ToList();
    }

    private static TableRef? Describe(IReadOnlyEntityType entity)
    {
        var table = entity.GetTableName();
        return string.IsNullOrEmpty(table) ? null : new TableRef(entity.GetSchema() ?? "", table);
    }

    private sealed record TableRef(string Schema, string Table)
    {
        public override string ToString() => $"{Schema}.{Table}";
    }
}
