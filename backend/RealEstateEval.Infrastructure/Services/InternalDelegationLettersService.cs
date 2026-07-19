using System.Globalization;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RealEstateEval.Application.Abstractions;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;

namespace RealEstateEval.Infrastructure.Services;

public sealed class InternalDelegationLettersService : IInternalDelegationLettersService
{
    private const string Dept = "DS";
    private const string DocType = "LT";

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
    };

    private readonly ApplicationDbContext _db;

    public InternalDelegationLettersService(ApplicationDbContext db) => _db = db;

    public async Task<IReadOnlyList<InternalDelegationLetterDto>> GetForScopeAsync(
        string scopeKey,
        CancellationToken cancellationToken = default)
    {
        var key = scopeKey.Trim();
        if (key.Length == 0) return [];

        var row = await _db.InternalDelegationLetterSets.AsNoTracking()
            .FirstOrDefaultAsync(x => x.ScopeKey == key, cancellationToken);
        return row is null ? [] : Deserialize(row.LettersJson);
    }

    public async Task<IReadOnlyList<InternalDelegationLetterDto>> SaveAsync(
        SaveInternalDelegationLettersRequest request,
        CancellationToken cancellationToken = default)
    {
        var key = request.ScopeKey.Trim();
        if (key.Length == 0) return [];

        var strategy = _db.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            await using var tx = await _db.Database.BeginTransactionAsync(cancellationToken);
            await AcquireScopeLockAsync(key, cancellationToken);

            var existing = await LoadForUpdateAsync(key, cancellationToken);
            var byId = existing.ToDictionary(l => l.Id, StringComparer.Ordinal);
            var merged = new List<InternalDelegationLetterDto>();

            foreach (var incoming in request.Letters ?? [])
            {
                if (byId.TryGetValue(incoming.Id, out var prior) && !string.IsNullOrWhiteSpace(prior.Reference))
                {
                    // الخطاب المُصدَر لا يُستبدل — نحافظ على snapshot الإصدار.
                    merged.Add(prior);
                    byId.Remove(incoming.Id);
                    continue;
                }

                merged.Add(incoming);
                byId.Remove(incoming.Id);
            }

            // أبقِ الخطابات المُصدَرة التي لم تأتِ في الطلب.
            foreach (var leftover in byId.Values)
            {
                if (!string.IsNullOrWhiteSpace(leftover.Reference))
                    merged.Add(leftover);
            }

            await UpsertAsync(key, merged, cancellationToken, save: false);
            await _db.SaveChangesAsync(cancellationToken);
            await tx.CommitAsync(cancellationToken);
            return (IReadOnlyList<InternalDelegationLetterDto>)merged;
        });
    }

    public async Task<(InternalDelegationLetterDto? Letter, string? Error)> IssueAsync(
        IssueInternalDelegationLetterRequest request,
        CancellationToken cancellationToken = default)
    {
        var key = request.ScopeKey.Trim();
        var letterId = request.LetterId.Trim();
        if (key.Length == 0) return (null, "scopeKey مطلوب");
        if (letterId.Length == 0) return (null, "letterId مطلوب");
        if (request.SelectedProperties is null || request.SelectedProperties.Count == 0)
            return (null, "يجب اختيار عقار واحد على الأقل");

        var strategy = _db.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            await using var tx = await _db.Database.BeginTransactionAsync(cancellationToken);
            await AcquireScopeLockAsync(key, cancellationToken);

            var letters = (await LoadForUpdateAsync(key, cancellationToken)).ToList();
            var idx = letters.FindIndex(l => l.Id == letterId);
            if (idx < 0)
            {
                // أنشئ مسودة من الطلب إن لم تُحفظ بعد.
                var parts = letterId.Split("::", 2, StringSplitOptions.None);
                letters.Add(new InternalDelegationLetterDto
                {
                    Id = letterId,
                    Court = (request.Court ?? parts.ElementAtOrDefault(0) ?? "").Trim(),
                    Circuit = (request.Circuit ?? parts.ElementAtOrDefault(1) ?? "—").Trim(),
                    City = (request.City ?? "").Trim(),
                    SelectedProperties = request.SelectedProperties.ToList(),
                    CreatedAt = DateTime.UtcNow.ToString("O"),
                });
                idx = letters.Count - 1;
            }

            var current = letters[idx];
            if (!string.IsNullOrWhiteSpace(current.Reference))
            {
                // مُصدَر مسبقاً — أعده كما هو.
                await tx.CommitAsync(cancellationToken);
                return (current, null);
            }

            var now = DateTime.UtcNow;
            var riyadh = TimeZoneInfo.FindSystemTimeZoneById(
                OperatingSystem.IsWindows() ? "Arab Standard Time" : "Asia/Riyadh");
            var local = TimeZoneInfo.ConvertTimeFromUtc(now, riyadh);
            var dateKey = local.ToString("yyMMdd", CultureInfo.InvariantCulture);
            var dateGreg = local.ToString("yyyy/M/d", CultureInfo.InvariantCulture) + " م";
            var dateHijri = FormatHijri(local);

            string reference;
            try
            {
                reference = await NextReferenceAsync(dateKey, now, cancellationToken);
            }
            catch (InvalidOperationException ex)
            {
                await tx.RollbackAsync(cancellationToken);
                return (null, ex.Message);
            }

            var issued = new InternalDelegationLetterDto
            {
                Id = current.Id,
                City = !string.IsNullOrWhiteSpace(request.City) ? request.City.Trim() : current.City,
                Court = !string.IsNullOrWhiteSpace(request.Court) ? request.Court.Trim() : current.Court,
                Circuit = !string.IsNullOrWhiteSpace(request.Circuit)
                    ? request.Circuit.Trim()
                    : current.Circuit,
                SelectedProperties = request.SelectedProperties.ToList(),
                IssuedProperties = request.SelectedProperties.ToList(),
                Reference = reference,
                DateHijri = dateHijri,
                DateGreg = dateGreg,
                IssuedAt = now.ToString("O"),
                Agent = request.Agent,
                CreatedAt = current.CreatedAt,
            };

            letters[idx] = issued;
            await UpsertAsync(key, letters, cancellationToken, save: false);
            await _db.SaveChangesAsync(cancellationToken);
            await tx.CommitAsync(cancellationToken);
            return ((InternalDelegationLetterDto?)issued, (string?)null);
        });
    }

    private async Task AcquireScopeLockAsync(string scopeKey, CancellationToken cancellationToken)
    {
        if (!_db.Database.IsNpgsql()) return;

        // قفل نطاق المعاملة لمنع تعارض Save/Issue المتزامنين على نفس ScopeKey.
        await _db.Database.ExecuteSqlAsync(
            $"SELECT pg_advisory_xact_lock(hashtext({scopeKey}))",
            cancellationToken);
    }

    private async Task<List<InternalDelegationLetterDto>> LoadForUpdateAsync(
        string scopeKey,
        CancellationToken cancellationToken)
    {
        var row = await _db.InternalDelegationLetterSets
            .FirstOrDefaultAsync(x => x.ScopeKey == scopeKey, cancellationToken);
        return row is null ? [] : Deserialize(row.LettersJson).ToList();
    }

    private async Task UpsertAsync(
        string scopeKey,
        IReadOnlyList<InternalDelegationLetterDto> letters,
        CancellationToken cancellationToken,
        bool save = true)
    {
        var payload = JsonSerializer.Serialize(letters, JsonOpts);
        var row = await _db.InternalDelegationLetterSets
            .FirstOrDefaultAsync(x => x.ScopeKey == scopeKey, cancellationToken);
        var now = DateTime.UtcNow;

        if (row is null)
        {
            _db.InternalDelegationLetterSets.Add(new InternalDelegationLetterSet
            {
                Id = Guid.NewGuid(),
                ScopeKey = scopeKey,
                LettersJson = payload,
                UpdatedAtUtc = now,
            });
        }
        else
        {
            row.LettersJson = payload;
            row.UpdatedAtUtc = now;
        }

        if (save) await _db.SaveChangesAsync(cancellationToken);
    }

    private async Task<string> NextReferenceAsync(
        string dateKey,
        DateTime nowUtc,
        CancellationToken cancellationToken)
    {
        if (_db.Database.IsNpgsql())
        {
            var id = Guid.NewGuid();
            var rows = await _db.Database
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
                    Dept,
                    DocType,
                    dateKey,
                    nowUtc)
                .ToListAsync(cancellationToken);

            var seq = rows.FirstOrDefault();
            if (seq <= 0)
                throw new InvalidOperationException("تعذّر توليد الرقم المرجعي.");
            if (seq > 999)
                throw new InvalidOperationException("تجاوز عدّاد المراجع اليومي الحد الأقصى (999).");
            return $"{Dept}-{DocType}-{dateKey}-{seq:D3}";
        }

        // مسار InMemory / غير PostgreSQL للاختبارات.
        var counter = await _db.DocumentReferenceCounters
            .FirstOrDefaultAsync(
                c => c.Dept == Dept && c.Type == DocType && c.DateKey == dateKey,
                cancellationToken);

        if (counter is null)
        {
            counter = new DocumentReferenceCounter
            {
                Id = Guid.NewGuid(),
                Dept = Dept,
                Type = DocType,
                DateKey = dateKey,
                Seq = 1,
                UpdatedAtUtc = nowUtc,
            };
            _db.DocumentReferenceCounters.Add(counter);
        }
        else
        {
            if (counter.Seq >= 999)
                throw new InvalidOperationException("تجاوز عدّاد المراجع اليومي الحد الأقصى (999).");
            counter.Seq += 1;
            counter.UpdatedAtUtc = nowUtc;
        }

        return $"{Dept}-{DocType}-{dateKey}-{counter.Seq:D3}";
    }

    private static string FormatHijri(DateTime local)
    {
        try
        {
            var parts = new IntlHijri(local);
            return $"{parts.Year}/{parts.Month}/{parts.Day} هـ";
        }
        catch
        {
            return local.ToString("yyyy/M/d", CultureInfo.InvariantCulture) + " هـ";
        }
    }

    /// <summary>تنسيق هجري أم القرى عبر تقويم النظام إن توفر.</summary>
    private readonly struct IntlHijri
    {
        public int Year { get; }
        public int Month { get; }
        public int Day { get; }

        public IntlHijri(DateTime local)
        {
            var cal = new HijriCalendar();
            // Umm al-Qura غير مضمونة في كل runtime؛ HijriCalendar تقريب مقبول للعرض.
            Year = cal.GetYear(local);
            Month = cal.GetMonth(local);
            Day = cal.GetDayOfMonth(local);
        }
    }

    private static IReadOnlyList<InternalDelegationLetterDto> Deserialize(string json)
    {
        try
        {
            return JsonSerializer.Deserialize<List<InternalDelegationLetterDto>>(json, JsonOpts) ?? [];
        }
        catch
        {
            return [];
        }
    }
}
