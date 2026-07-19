using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using RealEstateEval.Application.Contracts;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Caching;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Services;

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

        var audit = Assert.Single(db.CourtAuditLogs.Where(a => a.EntityId == court!.Id));
        Assert.Equal(CourtAuditActions.CourtCreated, audit.Action);
        Assert.Equal(CourtAuditEntityTypes.Court, audit.EntityType);
        Assert.Equal(court!.Id, audit.EntityId);
        Assert.Equal("actor-1", audit.ActorId);

        using var json = JsonDocument.Parse(audit.ChangesJson);
        Assert.Equal("محكمة اختبار التدقيق", json.RootElement.GetProperty("name").GetProperty("after").GetString());
        Assert.True(json.RootElement.GetProperty("isActive").GetProperty("after").GetBoolean());
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

        db.CourtAuditLogs.RemoveRange(db.CourtAuditLogs);
        await db.SaveChangesAsync();

        var (updated, error) = await service.UpdateAsync(
            created!.Id,
            new UpdateCourtRequest { Name = "محكمة اختبار التعديل - محدّثة" },
            "actor-2");

        Assert.Null(error);
        Assert.NotNull(updated);

        var audit = Assert.Single(db.CourtAuditLogs);
        Assert.Equal(CourtAuditActions.CourtUpdated, audit.Action);
        Assert.Equal("actor-2", audit.ActorId);

        using var json = JsonDocument.Parse(audit.ChangesJson);
        Assert.Equal("محكمة اختبار التعديل", json.RootElement.GetProperty("name").GetProperty("before").GetString());
        Assert.Equal("محكمة اختبار التعديل - محدّثة", json.RootElement.GetProperty("name").GetProperty("after").GetString());
        Assert.False(json.RootElement.TryGetProperty("city", out _));
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

        db.CourtAuditLogs.RemoveRange(db.CourtAuditLogs);
        await db.SaveChangesAsync();

        await service.SetCourtStatusAsync(created!.Id, false, "actor-2");
        await service.SetCourtStatusAsync(created.Id, true, "actor-3");

        var audits = db.CourtAuditLogs.OrderBy(a => a.TimestampUtc).ToList();
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

        db.CourtAuditLogs.RemoveRange(db.CourtAuditLogs);
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

        var actions = db.CourtAuditLogs.Select(a => a.Action).ToList();
        Assert.Contains(CourtAuditActions.CircuitCreated, actions);
        Assert.Contains(CourtAuditActions.CircuitUpdated, actions);
        Assert.Contains(CourtAuditActions.CircuitDeactivated, actions);

        var update = Assert.Single(db.CourtAuditLogs, a => a.Action == CourtAuditActions.CircuitUpdated);
        using var json = JsonDocument.Parse(update.ChangesJson);
        Assert.Equal("الأولى", json.RootElement.GetProperty("circuitNo").GetProperty("before").GetString());
        Assert.Equal("الثانية", json.RootElement.GetProperty("circuitNo").GetProperty("after").GetString());
    }

    [Fact]
    public async Task EnsureSeededAsync_does_not_write_admin_audit()
    {
        await using var db = CreateDb();
        var service = CreateService(db);

        await service.EnsureSeededAsync();

        Assert.Empty(db.CourtAuditLogs);
        Assert.NotEmpty(db.Courts);
    }

    private static CourtsService CreateService(ApplicationDbContext db)
    {
        var cache = new ApiResponseCache(
            new NullDistributedCache(),
            Options.Create(new RedisCacheOptions { Enabled = false }),
            NullLogger<ApiResponseCache>.Instance);
        return new CourtsService(db, cache);
    }

    private static ApplicationDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase($"courts-audit-{Guid.NewGuid():N}")
            .Options;
        return new ApplicationDbContext(options);
    }

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
