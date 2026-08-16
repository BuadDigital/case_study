using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Architecture.Tests.Support;

/// <summary>
/// Reads the legacy <see cref="ApplicationDbContext"/> model without touching a database.
/// The model is the authority for table and schema placement; the ownership catalog is the
/// authority for who may write each table.
/// </summary>
internal static class EfModelFacts
{
    private static readonly Lazy<IModel> LazyModel = new(BuildModel);

    public static IModel Model => LazyModel.Value;

 /// <summary>Mapped table name to schema, including inherited ASP.NET Identity tables.</summary>
    public static IReadOnlyDictionary<string, string> SchemaByTable { get; } = BuildSchemaByTable();

 /// <summary>Public <c>DbSet</c> property name (declared or inherited) to mapped table name.</summary>
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

    private static IModel BuildModel()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
 // Never opened: only the relational model metadata is required.
            .UseNpgsql("Host=architecture-tests;Database=model_only;Username=none;Password=none")
            .Options;

        using var context = new ApplicationDbContext(options);
        return context.Model;
    }

    private static Dictionary<string, string> BuildSchemaByTable()
    {
        var result = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var entity in Model.GetEntityTypes())
        {
            var table = entity.GetTableName();
            if (string.IsNullOrEmpty(table)) continue;
            result[table] = entity.GetSchema() ?? "";
        }

        return result;
    }

    private static Dictionary<string, string> BuildSchemaByEntityName()
    {
        var result = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var entity in Model.GetEntityTypes())
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
        var setProperties = typeof(ApplicationDbContext)
            .GetProperties()
            .Where(property =>
                property.PropertyType.IsGenericType
                && property.PropertyType.GetGenericTypeDefinition() == typeof(DbSet<>));

        foreach (var property in setProperties)
        {
            var clrType = property.PropertyType.GetGenericArguments()[0];
            var entity = Model.FindEntityType(clrType);
            var table = entity?.GetTableName();
            if (!string.IsNullOrEmpty(table))
                result[property.Name] = table;
        }

        return result;
    }

    private static List<string> BuildCrossSchemaForeignKeys()
    {
        var links = new SortedSet<string>(StringComparer.Ordinal);
        foreach (var entity in Model.GetEntityTypes())
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
        foreach (var entity in Model.GetEntityTypes())
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
