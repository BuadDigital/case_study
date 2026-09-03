using Microsoft.EntityFrameworkCore;
using RealEstateEval.CaseStudy.Application.Abstractions;

namespace RealEstateEval.CaseStudy.Infrastructure.Persistence;

/// <summary>
/// Translates EF's concurrency failure into the Application-level
/// <see cref="PersistenceConcurrencyException"/> so use cases never name an ORM type.
/// </summary>
internal static class EfConcurrency
{
    public static async Task SaveAsync(DbContext db, CancellationToken cancellationToken)
    {
        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException ex)
        {
            throw new PersistenceConcurrencyException(Describe(ex), ex);
        }
    }

    public static string Describe(DbUpdateConcurrencyException ex) =>
        string.Join(", ", ex.Entries.Select(e => e.Metadata.ClrType.Name + ":" + e.State));
}
