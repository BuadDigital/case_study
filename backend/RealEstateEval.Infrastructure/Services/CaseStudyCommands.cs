using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Rules;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data.Contexts;

namespace RealEstateEval.Infrastructure.Services;

public sealed class CaseStudyCommands : ICaseStudyCommands
{
    private readonly CaseStudyDbContext _caseStudy;
    private readonly TimeProvider _time;

    public CaseStudyCommands(CaseStudyDbContext caseStudy, TimeProvider? time = null)
    {
        _caseStudy = caseStudy;
        _time = time ?? TimeProvider.System;
    }

    public async Task<(string? Reference, string? Error)> AllocateDocumentReferenceAsync(
        string dept,
        string type,
        string dateKey,
        CancellationToken cancellationToken = default)
    {
        var normalizedDept = (dept ?? "").Trim();
        var normalizedType = (type ?? "").Trim();
        var normalizedDate = (dateKey ?? "").Trim();
        if (normalizedDept.Length == 0 || normalizedType.Length == 0 || normalizedDate.Length == 0)
            return (null, "dept, type, and dateKey are required");

        var nowUtc = _time.UtcNow();
        if (_caseStudy.Database.IsNpgsql())
        {
            var id = Guid.NewGuid();
            var rows = await _caseStudy.Database
                .SqlQueryRaw<int>(
                    """
                    INSERT INTO case_study."DocumentReferenceCounters"
                        ("Id", "Dept", "Type", "DateKey", "Seq", "UpdatedAtUtc")
                    VALUES ({0}, {1}, {2}, {3}, 1, {4})
                    ON CONFLICT ("Dept", "Type", "DateKey")
                    DO UPDATE SET
                        "Seq" = case_study."DocumentReferenceCounters"."Seq" + 1,
                        "UpdatedAtUtc" = EXCLUDED."UpdatedAtUtc"
                    RETURNING "Seq"
                    """,
                    id,
                    normalizedDept,
                    normalizedType,
                    normalizedDate,
                    nowUtc)
                .ToListAsync(cancellationToken);

            var seq = rows.FirstOrDefault();
            if (seq <= 0)
                return (null, "تعذّر توليد رقم كشف الفوترة.");
            if (seq > 999)
                return (null, "تجاوز عدّاد كشوف الفوترة اليومي الحد الأقصى (999).");
            return ($"{normalizedDept}-{normalizedType}-{normalizedDate}-{seq:D3}", null);
        }

        var counter = await _caseStudy.DocumentReferenceCounters
            .FirstOrDefaultAsync(
                c => c.Dept == normalizedDept && c.Type == normalizedType && c.DateKey == normalizedDate,
                cancellationToken);

        if (counter is null)
        {
            counter = new DocumentReferenceCounter
            {
                Id = Guid.NewGuid(),
                Dept = normalizedDept,
                Type = normalizedType,
                DateKey = normalizedDate,
                Seq = 1,
                UpdatedAtUtc = nowUtc,
            };
            _caseStudy.DocumentReferenceCounters.Add(counter);
        }
        else
        {
            if (counter.Seq >= 999)
                return (null, "تجاوز عدّاد كشوف الفوترة اليومي الحد الأقصى (999).");
            counter.Seq += 1;
            counter.UpdatedAtUtc = nowUtc;
        }

        await _caseStudy.SaveChangesAsync(cancellationToken);
        return ($"{normalizedDept}-{normalizedType}-{normalizedDate}-{counter.Seq:D3}", null);
    }

    public async Task BackfillPropertyAreaIfEmptyAsync(
        Guid propertyId,
        decimal areaM2,
        CancellationToken cancellationToken = default)
    {
        if (areaM2 <= 0m)
            return;

        var property = await _caseStudy.WorkOrderProperties
            .FirstOrDefaultAsync(p => p.Id == propertyId, cancellationToken);
        if (property is null)
            return;
        if (EngineeringSurveyFeeRules.TryParseAreaM2(property.Area, out _))
            return;

        property.Area = areaM2.ToString(System.Globalization.CultureInfo.InvariantCulture);
        await _caseStudy.SaveChangesAsync(cancellationToken);
    }
}
