using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace RealEstateEval.Infrastructure.Data;

/// <summary>Model conventions shared by every bounded-context <c>DbContext</c>.</summary>
public static class ModelConventions
{
    /// <summary>
    /// Maps a shadow row-version property to PostgreSQL's system <c>xmin</c> column.
    /// Npgsql updates xmin for every write, so EF includes the value loaded at query time
    /// in UPDATE/DELETE predicates and throws when another request changed the row first.
    /// </summary>
    public static EntityTypeBuilder<TEntity> UseOptimisticConcurrency<TEntity>(
        this EntityTypeBuilder<TEntity> entity)
        where TEntity : class
    {
        entity.Property<uint>("Version").IsRowVersion();
        return entity;
    }
}
