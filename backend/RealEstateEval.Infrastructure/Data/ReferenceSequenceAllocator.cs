using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using RealEstateEval.Domain;

namespace RealEstateEval.Infrastructure.Data;

/// <summary>
/// تخصيص الأرقام المرجعية السنوية (ورشة الترقيم — بنود البتّ 1–2): كل سياق مالك
/// يخصص محلياً من جدوله <c>ReferenceSequences</c> — لا نداء عابر للخدمات ولا
/// دورة اعتماديات. الصيغة نفسها من <see cref="ReferenceNumbering.Format"/> حصراً.
/// </summary>
public static class ReferenceSequenceAllocator
{
 /// <summary>تحميل زائد للسياقات الملموسة — يفوّض إلى مسار الواجهات الأولية.</summary>
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
 /// يخصص الرقم التالي للبادئة في سنة «الآن» (بتوقيت الرياض) ويعيده مُنسَّقاً.
 /// upsert ذري على Npgsql؛ ومسار EF بديل لمزودي الاختبار. واجهات أولية كي
 /// تعمل عبر facade المستودعات (ICaseStudyRepository) كما عبر السياقات الملموسة.
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
 // المخطط واسم الجدول ثابتان من السياق المالك لا من مدخلات المستخدم —
 // الدمج النصي آمن هنا.
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
