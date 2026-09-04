using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Caching;
using RealEstateEval.Infrastructure.Data.Contexts;
using RealEstateEval.Infrastructure.Services;
using RealEstateEval.Platform.Infrastructure.Data.Contexts;
using RealEstateEval.Platform.Application.Services;
using RealEstateEval.Platform.Infrastructure.Persistence;
using RealEstateEval.Platform.Infrastructure.Services;
using RealEstateEval.Platform.Application.Contracts;
using RealEstateEval.Platform.Domain;

namespace RealEstateEval.Application.Tests;

public class CourtsServiceAuditTests
{
    [Fact]
    public async Task CreateAsync_writes_court_created_audit()
    {
        await using var db = CreateDb();
        var service = CreateService(db);

        var (court, error) = await service.CreateAsync(
            new CreateCourtRequest
            {
                Name = "محكمة اختبار التدقيق",
                Region = "منطقة الاختبار",
                City = "مدينة الاختبار",
                IsActive = true,
            },
            "actor-1");

        Assert.Null(error);
        Assert.NotNull(court);

        var audit = Assert.Single(db.AuditLogs.Where(a => a.EntityId == court!.Id.ToString()));
        Assert.Equal(CourtAuditActions.CourtCreated, audit.Action);
        Assert.Equal(CourtAuditEntityTypes.Court, audit.EntityType);
        Assert.Equal(court!.Id.ToString(), audit.EntityId);
        Assert.Equal("actor-1", audit.ActorId);

        using var json = JsonDocument.Parse(audit.AfterJson);
        Assert.Equal("محكمة اختبار التدقيق", json.RootElement.GetProperty("name").GetString());
        Assert.True(json.RootElement.GetProperty("isActive").GetBoolean());
    }

    [Fact]
    public async Task UpdateAsync_writes_before_after_for_changed_fields_only()
    {
        await using var db = CreateDb();
        var service = CreateService(db);
        var (created, _) = await service.CreateAsync(
            new CreateCourtRequest
            {
                Name = "محكمة اختبار التعديل",
                Region = "منطقة الاختبار",
                City = "مدينة التعديل",
                IsActive = true,
            },
            "actor-1");

        db.AuditLogs.RemoveRange(db.AuditLogs);
        await db.SaveChangesAsync();

        var (updated, error) = await service.UpdateAsync(
            created!.Id,
            new UpdateCourtRequest { Name = "محكمة اختبار التعديل - محدّثة" },
            "actor-2");

        Assert.Null(error);
        Assert.NotNull(updated);

        var audit = Assert.Single(db.AuditLogs);
        Assert.Equal(CourtAuditActions.CourtUpdated, audit.Action);
        Assert.Equal("actor-2", audit.ActorId);

        using var before = JsonDocument.Parse(audit.BeforeJson);
        using var after = JsonDocument.Parse(audit.AfterJson);
        Assert.Equal("محكمة اختبار التعديل", before.RootElement.GetProperty("name").GetString());
        Assert.Equal("محكمة اختبار التعديل - محدّثة", after.RootElement.GetProperty("name").GetString());
        Assert.False(after.RootElement.TryGetProperty("city", out _));
    }

    [Fact]
    public async Task SetCourtStatusAsync_writes_activated_and_deactivated()
    {
        await using var db = CreateDb();
        var service = CreateService(db);
        var (created, _) = await service.CreateAsync(
            new CreateCourtRequest
            {
                Name = "محكمة اختبار الحالة",
                Region = "منطقة الاختبار",
                City = "مدينة الحالة",
                IsActive = true,
            },
            "actor-1");

        db.AuditLogs.RemoveRange(db.AuditLogs);
        await db.SaveChangesAsync();

        await service.SetCourtStatusAsync(created!.Id, false, "actor-2");
        await service.SetCourtStatusAsync(created.Id, true, "actor-3");

        var audits = db.AuditLogs.OrderBy(a => a.CreatedAtUtc).ToList();
        Assert.Equal(2, audits.Count);
        Assert.Equal(CourtAuditActions.CourtDeactivated, audits[0].Action);
        Assert.Equal(CourtAuditActions.CourtActivated, audits[1].Action);
        Assert.Equal("actor-2", audits[0].ActorId);
        Assert.Equal("actor-3", audits[1].ActorId);
    }

    [Fact]
    public async Task Circuit_create_update_status_write_audit_events()
    {
        await using var db = CreateDb();
        var service = CreateService(db);
        var (court, _) = await service.CreateAsync(
            new CreateCourtRequest
            {
                Name = "محكمة اختبار الدوائر",
                Region = "منطقة الاختبار",
                City = "مدينة الدوائر",
                IsActive = true,
            },
            "actor-1");

        db.AuditLogs.RemoveRange(db.AuditLogs);
        await db.SaveChangesAsync();

        var (circuit, createError) = await service.CreateCircuitAsync(
            court!.Id,
            new CreateCourtCircuitRequest
            {
                CircuitNo = "الأولى",
                CircuitName = "دائرة التنفيذ الأولى",
                IsActive = true,
            },
            "actor-2");
        Assert.Null(createError);

        await service.UpdateCircuitAsync(
            court.Id,
            circuit!.Id,
            new UpdateCourtCircuitRequest { CircuitNo = "الثانية" },
            "actor-3");

        await service.SetCircuitStatusAsync(court.Id, circuit.Id, false, "actor-4");

        var actions = db.AuditLogs.Select(a => a.Action).ToList();
        Assert.Contains(CourtAuditActions.CircuitCreated, actions);
        Assert.Contains(CourtAuditActions.CircuitUpdated, actions);
        Assert.Contains(CourtAuditActions.CircuitDeactivated, actions);

        var update = Assert.Single(db.AuditLogs, a => a.Action == CourtAuditActions.CircuitUpdated);
        using var before = JsonDocument.Parse(update.BeforeJson);
        using var after = JsonDocument.Parse(update.AfterJson);
        Assert.Equal("الأولى", before.RootElement.GetProperty("circuitNo").GetString());
        Assert.Equal("الثانية", after.RootElement.GetProperty("circuitNo").GetString());
    }

    [Fact]
    public async Task EnsureSeededAsync_does_not_write_admin_audit()
    {
        await using var db = CreateDb();
        var service = CreateService(db);

        await service.EnsureSeededAsync();

        Assert.Empty(db.AuditLogs);
        Assert.NotEmpty(db.Courts);
    }

    [Fact]
    public async Task EnsureSeededAsync_adds_fourteen_execution_courts_with_thirty_five_circuits_each()
    {
        await using var db = CreateDb();
        var service = CreateService(db);

        await service.EnsureSeededAsync();

        var executionCourts = await db.Courts
            .Include(c => c.Circuits)
            .Where(c => c.Name.StartsWith("محكمة التنفيذ ب"))
            .ToListAsync();

        Assert.Equal(14, executionCourts.Count);
        Assert.All(executionCourts, court =>
        {
            Assert.True(court.IsActive);
            Assert.Equal(35, court.Circuits.Count);
            Assert.Equal(
                Enumerable.Range(1, 35).Select(n => n.ToString()),
                court.Circuits.OrderBy(c => int.Parse(c.CircuitNo)).Select(c => c.CircuitNo));
        });
        Assert.Equal(490, executionCourts.Sum(c => c.Circuits.Count));
    }

    [Fact]
    public async Task EnsureSeededAsync_is_idempotent_and_normalizes_system_legacy_circuits()
    {
        await using var db = CreateDb();
        var court = new Court
        {
            Id = Guid.NewGuid(),
            Name = "محكمة التنفيذ بالرياض",
            Region = "الرياض",
            City = "الرياض",
            IsActive = true,
            CreatedBy = "system",
            CreatedAtUtc = DateTime.UtcNow,
        };
        court.Circuits.Add(new CourtCircuit
        {
            Id = Guid.NewGuid(),
            CourtId = court.Id,
            CircuitNo = "الدائرة الأولى",
            IsActive = true,
            CreatedBy = "system",
            CreatedAtUtc = DateTime.UtcNow,
        });
        db.Courts.Add(court);
        await db.SaveChangesAsync();
        var service = CreateService(db);

        await service.EnsureSeededAsync();
        await service.EnsureSeededAsync();

        var seeded = await db.Courts
            .Include(c => c.Circuits)
            .SingleAsync(c => c.Id == court.Id);
        Assert.Equal(35, seeded.Circuits.Count);
        var first = Assert.Single(seeded.Circuits, c => c.CircuitNo == "1");
        Assert.Equal("دائرة التنفيذ الأولى", first.CircuitName);
        Assert.Equal(14, await db.Courts.CountAsync(c => c.Name.StartsWith("محكمة التنفيذ ب")));
        Assert.Equal(490, await db.CourtCircuits.CountAsync(c =>
            c.Court!.Name.StartsWith("محكمة التنفيذ ب")));
    }

    private static CourtsService CreateService(PlatformDbContext db)
    {
        var cache = new ApiResponseCache(
            new NullDistributedCache(),
            Options.Create(new RedisCacheOptions { Enabled = false }),
            NullLogger<ApiResponseCache>.Instance);
        return new CourtsService(new CourtsRepository(db), cache, new AuditLogWriter());
    }

    private static PlatformDbContext CreateDb() => TestDatabases.Platform("courts-audit");

    private sealed class NullDistributedCache : IDistributedCache
    {
        public byte[]? Get(string key) => null;
        public Task<byte[]?> GetAsync(string key, CancellationToken token = default) =>
            Task.FromResult<byte[]?>(null);
        public void Refresh(string key) { }
        public Task RefreshAsync(string key, CancellationToken token = default) => Task.CompletedTask;
        public void Remove(string key) { }
        public Task RemoveAsync(string key, CancellationToken token = default) => Task.CompletedTask;
        public void Set(string key, byte[] value, DistributedCacheEntryOptions options) { }
        public Task SetAsync(
            string key,
            byte[] value,
            DistributedCacheEntryOptions options,
            CancellationToken token = default) => Task.CompletedTask;
    }
}
