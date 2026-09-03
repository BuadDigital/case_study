using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using RealEstateEval.Domain;

namespace RealEstateEval.Infrastructure.Data;

/// <summary>
/// Assignment of annual reference numbers (numbering shop — bit lines 1–2): each owner context
/// Allocates locally from its table <c>ReferenceSequences</c> — no transient call to services or
/// Credentials cycle. The same format is exclusively from <see cref="ReferenceNumbering.Format"/>.
/// </summary>
public static class ReferenceSequenceAllocator
{
 /// <summary>Overloading of concrete contexts — delegated to the primary interfaces path.</summary>
    public static Task<(string? Reference, string? Error)> AllocateYearlyAsync(
        DbContext db,
        string schema,
        string prefix,
        DateTime utcNow,
        CancellationToken cancellationToken = default) =>
        AllocateYearlyAsync(
            db.Database,
            db.Set<ReferenceSequence>(),
            db.SaveChangesAsync,
            schema,
            prefix,
            utcNow,
            cancellationToken);

 /// <summary>
 /// Assigns the next number to the prefix in the year “now” (Riyadh time) and returns it formatted.
 /// atomic upsert on npgsql; An alternative EF pathway for test providers. Callers pass the
 /// owner context's database facade and its ReferenceSequences set.
 /// </summary>
    public static async Task<(string? Reference, string? Error)> AllocateYearlyAsync(
        DatabaseFacade database,
        DbSet<ReferenceSequence> sequences,
        Func<CancellationToken, Task<int>> saveChangesAsync,
        string schema,
        string prefix,
        DateTime utcNow,
        CancellationToken cancellationToken = default)
    {
        var normalizedPrefix = (prefix ?? "").Trim();
        if (normalizedPrefix.Length == 0)
            return (null, "بادئة الرقم المرجعي مطلوبة.");

        var year = ReferenceNumbering.RiyadhYear(utcNow);

        if (database.IsNpgsql())
        {
 // The schema and table name are fixed from the owner context, not from user input —
 // Text merging is safe here.
            var table = ReferenceSequenceModel.TableNameFor(schema);
            var sql =
                $$"""
                INSERT INTO {{schema}}."{{table}}"
                    ("Id", "Prefix", "Year", "LastValue", "UpdatedAtUtc")
                VALUES ({0}, {1}, {2}, 1, {3})
                ON CONFLICT ("Prefix", "Year")
                DO UPDATE SET
                    "LastValue" = {{schema}}."{{table}}"."LastValue" + 1,
                    "UpdatedAtUtc" = EXCLUDED."UpdatedAtUtc"
                RETURNING "LastValue"
                """;
            var rows = await database
                .SqlQueryRaw<int>(sql, Guid.NewGuid(), normalizedPrefix, year, utcNow)
                .ToListAsync(cancellationToken);

            var seq = rows.FirstOrDefault();
            if (seq <= 0)
                return (null, "تعذّر تخصيص الرقم المرجعي.");
            if (seq > ReferenceNumbering.MaxYearlySequence)
                return (null, "تجاوز العدّاد السنوي للرقم المرجعي حده الأقصى.");
            return (ReferenceNumbering.Format(normalizedPrefix, year, seq), null);
        }

        var counter = await sequences
            .FirstOrDefaultAsync(
                c => c.Prefix == normalizedPrefix && c.Year == year,
                cancellationToken);
        if (counter is null)
        {
            counter = new ReferenceSequence
            {
                Id = Guid.NewGuid(),
                Prefix = normalizedPrefix,
                Year = year,
                LastValue = 1,
                UpdatedAtUtc = utcNow,
            };
            sequences.Add(counter);
        }
        else
        {
            if (counter.LastValue >= ReferenceNumbering.MaxYearlySequence)
                return (null, "تجاوز العدّاد السنوي للرقم المرجعي حده الأقصى.");
            counter.LastValue += 1;
            counter.UpdatedAtUtc = utcNow;
        }

        await saveChangesAsync(cancellationToken);
        return (ReferenceNumbering.Format(normalizedPrefix, year, counter.LastValue), null);
    }
}
