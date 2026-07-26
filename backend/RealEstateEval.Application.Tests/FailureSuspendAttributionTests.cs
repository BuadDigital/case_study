using Microsoft.EntityFrameworkCore;
using RealEstateEval.Domain;
using RealEstateEval.Infrastructure.Data;
using RealEstateEval.Infrastructure.Services;

namespace RealEstateEval.Application.Tests;

public class FailureSuspendAttributionTests
{
    private static readonly Guid FailureId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static readonly Guid PropertyId = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private static readonly string SupervisorUserId = "cccccccc-cccc-cccc-cccc-cccccccccccc";

    [Fact]
    public async Task Suspend_persists_actor_and_timestamp()
    {
        await using var db = CreateDb();
        SeedReviewFailure(db);
        var service = CreateFailureService(db);

        var before = DateTime.UtcNow;
        var dto = await service.SuspendAsync(FailureId, "تعليق للتحقق", SupervisorUserId);
        var after = DateTime.UtcNow;

        Assert.NotNull(dto);

        var entity = await db.PropertyFailures.AsNoTracking()
            .SingleAsync(f => f.Id == FailureId);
        Assert.Equal(PropertyFailureStatus.Suspended, entity.Status);
        Assert.Equal(SupervisorUserId, entity.SuspendedByUserId);
        Assert.NotNull(entity.SuspendedAtUtc);
        Assert.InRange(entity.SuspendedAtUtc!.Value, before.AddSeconds(-1), after.AddSeconds(1));
    }

    [Fact]
    public async Task Suspended_list_resolves_suspender_display_name_not_raiser()
    {
        await using var db = CreateDb();
        var suspendedAt = DateTime.UtcNow.AddHours(-2);
        db.Users.Add(new ApplicationUser
        {
            Id = SupervisorUserId,
            UserName = "supervisor",
            DisplayName = "مشرف الاختبار",
        });
        db.PropertyFailures.Add(new PropertyFailure
        {
            Id = FailureId,
            PoNumber = "PO-900",
            PropertyId = PropertyId.ToString(),
            DeedNumber = "D-1",
            Title = "تعذر",
            ProblemTypeId = "access",
            Severity = "internal",
            RaisedByRole = "مفتش ميداني",
            InternalNote = "ملاحظة",
            FinalNote = "ملاحظة المشرف",
            Status = PropertyFailureStatus.Suspended,
            Specialist = "specialist",
            SuspendedAtUtc = suspendedAt,
            SuspendedByUserId = SupervisorUserId,
            CreatedAtUtc = suspendedAt.AddDays(-1),
            UpdatedAtUtc = suspendedAt,
        });
        await db.SaveChangesAsync();

        var list = await new SuspendedTransactionsService(db).ListAsync();

        var row = Assert.Single(list);
        Assert.Equal(suspendedAt, row.SuspendedAt);
        Assert.Equal("مشرف الاختبار", row.SuspendedBy);
        Assert.Equal("مفتش ميداني", row.RaisedByRole);
        Assert.NotEqual(row.RaisedByRole, row.SuspendedBy);
    }

    [Fact]
    public async Task Suspended_list_leaves_SuspendedBy_blank_when_actor_unknown()
    {
        await using var db = CreateDb();
        var suspendedAt = DateTime.UtcNow.AddHours(-1);
        db.PropertyFailures.Add(new PropertyFailure
        {
            Id = FailureId,
            PoNumber = "PO-901",
            PropertyId = PropertyId.ToString(),
            DeedNumber = "D-2",
            Title = "تعذر تاريخي",
            ProblemTypeId = "access",
            Severity = "internal",
            RaisedByRole = "مفتش ميداني",
            InternalNote = "ملاحظة",
            FinalNote = "",
            Status = PropertyFailureStatus.Suspended,
            Specialist = "specialist",
            SuspendedAtUtc = suspendedAt,
            SuspendedByUserId = null,
            CreatedAtUtc = suspendedAt.AddDays(-1),
            UpdatedAtUtc = suspendedAt,
        });
        await db.SaveChangesAsync();

        var list = await new SuspendedTransactionsService(db).ListAsync();

        var row = Assert.Single(list);
        Assert.Equal("", row.SuspendedBy);
        Assert.Equal(suspendedAt, row.SuspendedAt);
    }

    private static void SeedReviewFailure(ApplicationDbContext db)
    {
        var now = DateTime.UtcNow;
        db.PropertyFailures.Add(new PropertyFailure
        {
            Id = FailureId,
            PoNumber = "PO-900",
            PropertyId = PropertyId.ToString(),
            DeedNumber = "D-1",
            Title = "تعذر",
            ProblemTypeId = "access",
            Severity = "internal",
            RaisedByRole = "مفتش ميداني",
            InternalNote = "ملاحظة",
            FinalNote = "",
            Status = PropertyFailureStatus.Review,
            Specialist = "specialist",
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        });
        db.SaveChanges();
    }

    private static ApplicationDbContext CreateDb()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase($"failure-suspend-{Guid.NewGuid():N}")
            .Options;
        return new ApplicationDbContext(options);
    }

    private static FailureService CreateFailureService(ApplicationDbContext db) =>
        new(
            db,
            null!,
            new PropertyTimelineService(db),
            null!,
            null!);
}
